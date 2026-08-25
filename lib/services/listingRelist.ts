import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidateBoardsBrowseCatalog } from "@/lib/cache/revalidate-boards-browse-catalog"
import {
  revalidateSellersAfterListingChange,
  revalidateSellersForUserIds,
} from "@/lib/cache/revalidate-sellers-directory-catalog"
import { revalidateRecentlySoldSurfaces } from "@/lib/cache/revalidate-home-public-catalog"
import { revalidateListingDetailPage } from "@/lib/cache/revalidate-listing-public-detail"
import { deleteAllCartRowsForListing } from "@/lib/db/cart-items-server"
import { syncListingToIndex } from "@/lib/elasticsearch/listings-index"
import { syncListingToGoogleMerchantBestEffort } from "@/lib/services/googleMerchantSync"
import { grantExclusiveWindowForRefundedOrderRelist } from "@/lib/services/listingBuyerExclusiveWindow"
import {
  recordListingVisibilityEvent,
  recordListingVisibilityEvents,
} from "@/lib/services/listingVisibilityAudit"
import { evaluateSellerCanSell } from "@/lib/services/sellerBan"
import { fetchSellerBanState, isSellerBanActive } from "@/lib/db/sellerBan"
import { listingIdsWithOpenMarketplaceCheckout } from "@/lib/db/listingDeleteEligibility"
import { createServiceRoleClient } from "@/lib/supabase/server"

function uniqueListingIds(listingIds: readonly (string | null | undefined)[]): string[] {
  return [...new Set(listingIds.filter((id): id is string => typeof id === "string" && id.length > 0))]
}

export type RelistAfterRefundOptions = {
  /**
   * `public` — live on site (default, existing behavior).
   * `vacation` — active but vacation-hidden so it appears in the seller’s listings as on vacation.
   */
  listingVisibility?: "public" | "vacation"
  /** Grant the original buyer the exclusive repurchase window (default true for public path). */
  grantExclusiveBuyerWindow?: boolean
}

/**
 * Re-activate listings after a full refund.
 * Only transitions from `sold` → `active`; archived/removed listings are left as-is.
 */
export async function relistListingsAfterRefund(
  supabase: SupabaseClient,
  listingIds: readonly (string | null | undefined)[],
  options: RelistAfterRefundOptions = {},
): Promise<string[]> {
  const listingVisibility = options.listingVisibility ?? "public"
  const uniqueIds = uniqueListingIds(listingIds)
  if (uniqueIds.length === 0) {
    revalidateRecentlySoldSurfaces()
    return []
  }

  const nowIso = new Date().toISOString()
  const { data: soldRows, error: soldErr } = await supabase
    .from("listings")
    .select("id, user_id")
    .in("id", uniqueIds)
    .eq("status", "sold")

  if (soldErr) {
    console.error("[relist] failed to load sold listings for refund relist", {
      listingIds: uniqueIds,
      error: soldErr,
    })
    revalidateRecentlySoldSurfaces()
    return []
  }

  const rows = soldRows ?? []
  if (rows.length === 0) {
    revalidateRecentlySoldSurfaces()
    return []
  }

  const sellerIds = [
    ...new Set(
      rows
        .map((row) => (row as { user_id?: string | null }).user_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ]

  const bannedSellerIds = new Set<string>()
  await Promise.all(
    sellerIds.map(async (sellerId) => {
      const banState = await fetchSellerBanState(supabase, sellerId)
      if (isSellerBanActive(banState)) bannedSellerIds.add(sellerId)
    }),
  )

  const liveIds = rows
    .filter((row) => {
      const sellerId = (row as { user_id?: string | null }).user_id
      return typeof sellerId === "string" && !bannedSellerIds.has(sellerId)
    })
    .map((row) => String((row as { id: string }).id))

  const delinquentIds = rows
    .filter((row) => {
      const sellerId = (row as { user_id?: string | null }).user_id
      return typeof sellerId === "string" && bannedSellerIds.has(sellerId)
    })
    .map((row) => String((row as { id: string }).id))

  const relistedIds: string[] = []
  const sellerUserIds: string[] = []
  const vacationHide = listingVisibility === "vacation"

  if (liveIds.length > 0) {
    const { data, error } = await supabase
      .from("listings")
      .update({
        status: "active",
        hidden_from_site: vacationHide,
        site_visibility_reason: vacationHide ? "seller_vacation" : null,
        updated_at: nowIso,
      })
      .in("id", liveIds)
      .eq("status", "sold")
      .select("id, user_id")

    if (error) {
      console.error("[relist] failed to reactivate listings after refund", {
        listingIds: liveIds,
        listingVisibility,
        error,
      })
    } else {
      for (const row of data ?? []) {
        const id = (row as { id?: string | null }).id
        const sellerId = (row as { user_id?: string | null }).user_id
        if (typeof id === "string" && id.length > 0) relistedIds.push(id)
        if (typeof sellerId === "string" && sellerId.length > 0) sellerUserIds.push(sellerId)
      }
    }
  }

  if (delinquentIds.length > 0) {
    const { data, error } = await supabase
      .from("listings")
      .update({
        status: "delinquent",
        hidden_from_site: true,
        site_visibility_reason: "seller_ban",
        updated_at: nowIso,
      })
      .in("id", delinquentIds)
      .eq("status", "sold")
      .select("id, user_id")

    if (error) {
      console.error("[relist] failed to mark banned-seller refund listings delinquent", {
        listingIds: delinquentIds,
        error,
      })
    } else {
      const restoredDelinquent = (data ?? [])
        .map((row) => (row as { id?: string | null }).id)
        .filter((id): id is string => typeof id === "string" && id.length > 0)
      await recordListingVisibilityEvents(
        supabase,
        restoredDelinquent.map((listingId) => ({
          listingId,
          hiddenFromSite: true,
          source: "seller_ban" as const,
          note: "Refund relist while seller banned — kept delinquent",
          metadata: { reason: "refund_seller_banned" },
        })),
      )
      for (const listingId of restoredDelinquent) {
        void syncListingToIndex(supabase, listingId)
      }
      for (const row of data ?? []) {
        const sellerId = (row as { user_id?: string | null }).user_id
        if (typeof sellerId === "string" && sellerId.length > 0) sellerUserIds.push(sellerId)
      }
    }
  }

  revalidateRecentlySoldSurfaces()

  if (relistedIds.length === 0 && delinquentIds.length === 0) {
    return []
  }

  if (relistedIds.length > 0) {
    revalidateBoardsBrowseCatalog()
    await revalidateSellersForUserIds(supabase, sellerUserIds)

    await recordListingVisibilityEvents(
      supabase,
      relistedIds.map((listingId) => ({
        listingId,
        hiddenFromSite: vacationHide,
        source: vacationHide ? ("seller_vacation" as const) : ("seller_relist" as const),
        note: vacationHide
          ? "Reactivated after refund — held on seller vacation"
          : "Reactivated after refund",
        metadata: {
          reason: vacationHide ? "refund_vacation_hold" : "refund",
        },
      })),
    )

    if (vacationHide) {
      await Promise.all(
        relistedIds.map(async (listingId) => {
          try {
            await deleteAllCartRowsForListing(supabase, listingId)
          } catch {
            // best-effort
          }
        }),
      )
    }

    for (const listingId of relistedIds) {
      void syncListingToGoogleMerchantBestEffort(supabase, listingId)
      void syncListingToIndex(supabase, listingId)
    }
  } else if (sellerUserIds.length > 0) {
    await revalidateSellersForUserIds(supabase, sellerUserIds)
  }

  return relistedIds
}

async function applyExclusiveBuyerWindowAfterRelist(
  supabase: SupabaseClient,
  orderId: string,
  relistedIds: readonly string[],
): Promise<void> {
  if (relistedIds.length === 0) return
  await grantExclusiveWindowForRefundedOrderRelist(supabase, orderId, relistedIds)
}

/** Re-activate a single listing after a full refund. */
export async function relistAfterRefund(
  supabase: SupabaseClient,
  listingId: string,
  options?: RelistAfterRefundOptions,
): Promise<void> {
  await relistListingsAfterRefund(supabase, [listingId], options)
}

/** Re-list every marketplace line on an order (primary `orders.listing_id` + `order_items`). */
export async function relistOrderListingsAfterRefund(
  supabase: SupabaseClient,
  orderId: string,
  options: RelistAfterRefundOptions = {},
): Promise<void> {
  const [{ data: order, error: orderErr }, { data: items, error: itemsErr }] = await Promise.all([
    supabase.from("orders").select("listing_id").eq("id", orderId).maybeSingle(),
    supabase.from("order_items").select("listing_id").eq("order_id", orderId),
  ])

  if (orderErr) {
    console.error("[relist] order lookup failed", { orderId, error: orderErr })
  }
  if (itemsErr) {
    console.error("[relist] order_items lookup failed", { orderId, error: itemsErr })
  }

  const listingIds = [
    (order as { listing_id?: string | null } | null)?.listing_id,
    ...(items ?? []).map((row) => (row as { listing_id?: string | null }).listing_id),
  ]

  const uniqueIds = uniqueListingIds(listingIds)
  const relistedIds = await relistListingsAfterRefund(supabase, uniqueIds, options)
  const grantExclusive =
    options.grantExclusiveBuyerWindow ?? options.listingVisibility !== "vacation"
  if (grantExclusive) {
    await applyExclusiveBuyerWindowAfterRelist(supabase, orderId, relistedIds)
  }
}

type SellerMarkedSoldListingRow = {
  id: string
  user_id: string
  status: string
  archived_at: string | null
  sold_off_platform: boolean | null
  hidden_from_site: boolean | null
  slug: string | null
}

export type RelistSellerMarkedSoldResult =
  | { ok: true }
  | { ok: false; status: number; error: string }

/**
 * Seller undo for “mark as sold” (off-platform). Marketplace checkout sales stay sold.
 */
export async function relistSellerMarkedSoldListing(
  supabase: SupabaseClient,
  params: { listingId: string; sellerUserId: string },
): Promise<RelistSellerMarkedSoldResult> {
  const { listingId, sellerUserId } = params

  const { data, error: loadError } = await supabase
    .from("listings")
    .select("id, user_id, status, archived_at, sold_off_platform, hidden_from_site, slug")
    .eq("id", listingId)
    .maybeSingle()

  if (loadError) {
    console.error("[relist] failed to load listing for seller relist", {
      listingId,
      error: loadError,
    })
    return { ok: false, status: 500, error: "Could not load listing" }
  }

  const row = data as SellerMarkedSoldListingRow | null
  if (!row) {
    return { ok: false, status: 404, error: "Not found" }
  }
  if (row.user_id !== sellerUserId) {
    return { ok: false, status: 403, error: "Forbidden" }
  }

  const sellGuard = await evaluateSellerCanSell(supabase, sellerUserId)
  if (!sellGuard.ok) {
    return { ok: false, status: 403, error: sellGuard.userMessage }
  }

  if (row.status !== "sold") {
    return { ok: false, status: 400, error: "Only sold listings can be relisted" }
  }
  if (row.archived_at) {
    return { ok: false, status: 400, error: "Archived listings cannot be relisted from here" }
  }
  if (row.sold_off_platform !== true) {
    return {
      ok: false,
      status: 400,
      error: "Listings sold on Reswell can’t be relisted this way",
    }
  }

  const checkoutSold = await listingIdsWithOpenMarketplaceCheckout(supabase, [listingId])
  if (checkoutSold.error) {
    return { ok: false, status: 500, error: "Could not verify listing" }
  }
  if (checkoutSold.listingIds.has(listingId)) {
    return {
      ok: false,
      status: 400,
      error: "Listings sold on Reswell can’t be relisted this way",
    }
  }

  const nowIso = new Date().toISOString()
  const { data: updated, error: updateError } = await supabase
    .from("listings")
    .update({
      status: "active",
      sold_off_platform: false,
      sold_off_platform_channel: null,
      sold_off_platform_detail: null,
      sold_off_platform_at: null,
      sold_reswell_helped_find_buyer: null,
      updated_at: nowIso,
    })
    .eq("id", listingId)
    .eq("user_id", sellerUserId)
    .eq("status", "sold")
    .eq("sold_off_platform", true)
    .is("archived_at", null)
    .select("id")
    .maybeSingle()

  if (updateError) {
    console.error("[relist] failed to reactivate seller-marked sold listing", {
      listingId,
      error: updateError,
    })
    return { ok: false, status: 500, error: "Failed to relist listing" }
  }
  if (!updated) {
    return { ok: false, status: 409, error: "Listing could not be relisted" }
  }

  const hiddenFromSite = row.hidden_from_site === true

  try {
    const service = createServiceRoleClient()
    await recordListingVisibilityEvent(service, {
      listingId,
      hiddenFromSite,
      source: "seller_relist",
      actorUserId: sellerUserId,
      note: "Seller relisted after marking sold",
      metadata: { reason: "undo_mark_sold" },
    })
  } catch {
    // best-effort
  }

  revalidateListingDetailPage(listingId, row.slug)
  revalidateBoardsBrowseCatalog()
  revalidateRecentlySoldSurfaces()
  await revalidateSellersAfterListingChange(supabase, sellerUserId)

  void syncListingToGoogleMerchantBestEffort(supabase, listingId)
  void syncListingToIndex(supabase, listingId)

  return { ok: true }
}
