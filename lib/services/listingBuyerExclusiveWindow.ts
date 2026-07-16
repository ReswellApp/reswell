import type { SupabaseClient } from "@supabase/supabase-js"

/** Days the original buyer may exclusively repurchase a listing after a full refund relist. */
export const LISTING_BUYER_EXCLUSIVE_WINDOW_DAYS = 5

export type ListingExclusiveBuyerFields = {
  exclusive_buyer_id: string | null
  exclusive_buyer_until: string | null
}

export type ListingExclusivePurchaseAccess =
  | { kind: "open" }
  | {
      kind: "exclusive_for_viewer"
      expiresAt: string
      expiresAtLabel: string
    }
  | {
      kind: "blocked_for_viewer"
      expiresAt: string
      expiresAtLabel: string
    }
  | {
      kind: "blocked_sign_in"
      expiresAt: string
      expiresAtLabel: string
    }

function formatExclusiveUntilLabel(untilIso: string): string {
  const until = new Date(untilIso)
  if (Number.isNaN(until.getTime())) return "soon"
  return until.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  })
}

export function isListingExclusiveBuyerWindowActive(
  listing: ListingExclusiveBuyerFields,
  referenceTime: Date = new Date(),
): boolean {
  const buyerId = listing.exclusive_buyer_id?.trim()
  const untilRaw = listing.exclusive_buyer_until?.trim()
  if (!buyerId || !untilRaw) return false
  const until = new Date(untilRaw)
  if (Number.isNaN(until.getTime())) return false
  return referenceTime < until
}

export function resolveListingExclusivePurchaseAccess(
  listing: ListingExclusiveBuyerFields,
  viewerUserId: string | null | undefined,
  referenceTime: Date = new Date(),
): ListingExclusivePurchaseAccess {
  if (!isListingExclusiveBuyerWindowActive(listing, referenceTime)) {
    return { kind: "open" }
  }

  const expiresAt = listing.exclusive_buyer_until!.trim()
  const expiresAtLabel = formatExclusiveUntilLabel(expiresAt)

  if (!viewerUserId?.trim()) {
    return { kind: "blocked_sign_in", expiresAt, expiresAtLabel }
  }

  if (viewerUserId === listing.exclusive_buyer_id) {
    return { kind: "exclusive_for_viewer", expiresAt, expiresAtLabel }
  }

  return { kind: "blocked_for_viewer", expiresAt, expiresAtLabel }
}

export function listingExclusivePurchaseBlockedMessage(
  access: ListingExclusivePurchaseAccess,
): string | null {
  switch (access.kind) {
    case "open":
    case "exclusive_for_viewer":
      return null
    case "blocked_sign_in":
      return `This item is reserved for the original buyer until ${access.expiresAtLabel}. Sign in with that account to purchase.`
    case "blocked_for_viewer":
      return `This item is reserved for the original buyer until ${access.expiresAtLabel}.`
  }
}

export async function fetchListingExclusiveBuyerFields(
  supabase: SupabaseClient,
  listingId: string,
): Promise<ListingExclusiveBuyerFields | null> {
  const { data, error } = await supabase
    .from("listings")
    .select("exclusive_buyer_id, exclusive_buyer_until")
    .eq("id", listingId)
    .maybeSingle()

  if (error || !data) return null
  return data as ListingExclusiveBuyerFields
}

export async function assertBuyerMayPurchaseListingExclusiveWindow(
  supabase: SupabaseClient,
  listingId: string,
  buyerId: string,
  referenceTime: Date = new Date(),
): Promise<{ ok: true } | { ok: false; message: string }> {
  const fields = await fetchListingExclusiveBuyerFields(supabase, listingId)
  if (!fields) {
    return { ok: false, message: "Listing not found" }
  }

  const access = resolveListingExclusivePurchaseAccess(fields, buyerId, referenceTime)
  const blocked = listingExclusivePurchaseBlockedMessage(access)
  if (blocked) {
    return { ok: false, message: blocked }
  }

  return { ok: true }
}

export async function assertBuyerMayPurchaseListingsExclusiveWindow(
  supabase: SupabaseClient,
  listingIds: readonly string[],
  buyerId: string,
  referenceTime: Date = new Date(),
): Promise<{ ok: true } | { ok: false; message: string }> {
  for (const listingId of listingIds) {
    const result = await assertBuyerMayPurchaseListingExclusiveWindow(
      supabase,
      listingId,
      buyerId,
      referenceTime,
    )
    if (!result.ok) return result
  }
  return { ok: true }
}

export async function grantListingBuyerExclusiveWindow(
  supabase: SupabaseClient,
  params: {
    listingId: string
    buyerId: string
    days?: number
    referenceTime?: Date
  },
): Promise<void> {
  const days = params.days ?? LISTING_BUYER_EXCLUSIVE_WINDOW_DAYS
  const referenceTime = params.referenceTime ?? new Date()
  const until = new Date(referenceTime.getTime())
  until.setUTCDate(until.getUTCDate() + days)

  const { error } = await supabase
    .from("listings")
    .update({
      exclusive_buyer_id: params.buyerId,
      exclusive_buyer_until: until.toISOString(),
      updated_at: referenceTime.toISOString(),
    })
    .eq("id", params.listingId)

  if (error) {
    console.error("[listing exclusive buyer] grant failed", {
      listingId: params.listingId,
      buyerId: params.buyerId,
      error,
    })
  }
}

export async function grantExclusiveWindowForRefundedOrderRelist(
  supabase: SupabaseClient,
  orderId: string,
  listingIds: readonly (string | null | undefined)[],
): Promise<void> {
  const uniqueIds = [
    ...new Set(
      listingIds.filter((id): id is string => typeof id === "string" && id.trim().length > 0),
    ),
  ]
  if (uniqueIds.length === 0) return

  const { data: order, error } = await supabase
    .from("orders")
    .select("buyer_id, status")
    .eq("id", orderId)
    .maybeSingle()

  if (error || !order) {
    console.error("[listing exclusive buyer] order lookup failed", { orderId, error })
    return
  }

  const buyerId = (order as { buyer_id?: string | null }).buyer_id?.trim()
  const status = (order as { status?: string | null }).status
  if (!buyerId || status !== "refunded") return

  for (const listingId of uniqueIds) {
    await grantListingBuyerExclusiveWindow(supabase, { listingId, buyerId })
  }
}
