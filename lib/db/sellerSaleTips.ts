import type { SupabaseClient } from "@supabase/supabase-js"

export type SellerSaleTipStatus = "pending" | "succeeded" | "canceled" | "failed"

const ID_LOOKUP_CHUNK = 200
const TIPS_FETCH_CAP = 20000
const ADMIN_SEED_TITLE = /^admin seed/i

export type SellerSaleTipRow = {
  id: string
  listing_id: string
  seller_user_id: string
  amount_cents: number
  stripe_payment_intent_id: string
  status: SellerSaleTipStatus
  created_at: string
  succeeded_at: string | null
}

export async function insertSellerSaleTip(
  supabase: SupabaseClient,
  row: {
    listingId: string
    sellerUserId: string
    amountCents: number
    stripePaymentIntentId: string
  },
): Promise<SellerSaleTipRow | null> {
  const { data, error } = await supabase
    .from("seller_sale_tips")
    .insert({
      listing_id: row.listingId,
      seller_user_id: row.sellerUserId,
      amount_cents: row.amountCents,
      stripe_payment_intent_id: row.stripePaymentIntentId,
      status: "pending",
    })
    .select(
      "id, listing_id, seller_user_id, amount_cents, stripe_payment_intent_id, status, created_at, succeeded_at",
    )
    .single()

  if (error) {
    console.error("[sellerSaleTips] insert failed", error)
    return null
  }
  return data as SellerSaleTipRow
}

export async function getSellerSaleTipByPaymentIntentId(
  supabase: SupabaseClient,
  paymentIntentId: string,
): Promise<SellerSaleTipRow | null> {
  const { data, error } = await supabase
    .from("seller_sale_tips")
    .select(
      "id, listing_id, seller_user_id, amount_cents, stripe_payment_intent_id, status, created_at, succeeded_at",
    )
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle()

  if (error) {
    console.error("[sellerSaleTips] load by payment intent failed", error)
    return null
  }
  return data as SellerSaleTipRow | null
}

export async function markSellerSaleTipSucceeded(
  supabase: SupabaseClient,
  paymentIntentId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("seller_sale_tips")
    .update({
      status: "succeeded",
      succeeded_at: new Date().toISOString(),
    })
    .eq("stripe_payment_intent_id", paymentIntentId)
    .eq("status", "pending")

  if (error) {
    console.error("[sellerSaleTips] mark succeeded failed", error)
    return false
  }
  return true
}

/** Off-platform mark-as-sold listing whose seller successfully tipped Reswell. */
export type TippedMarkSoldGmsContribution = {
  listingId: string
  sellerUserId: string
  listingPriceUsd: number
  /** Sum of succeeded tip amounts for this listing — 100% platform revenue. */
  tipAmountUsd: number
  succeededAt: string
}

/** One succeeded seller tip. Always platform revenue; independent of GMV inclusion. */
export type SellerSaleTipRevenue = {
  listingId: string
  amountUsd: number
  succeededAt: string
}

export type SellerSaleTipAdminFacts = {
  gms: TippedMarkSoldGmsContribution[]
  tipRevenues: SellerSaleTipRevenue[]
}

type TipSourceRow = {
  listing_id: string
  seller_user_id: string
  amount_cents: number
  succeeded_at: string | null
  created_at: string
}

type ListingGmsRow = {
  id: string
  price: unknown
  status: string
  title: string
}

function numPrice(value: unknown): number {
  if (value == null) return 0
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function centsToUsd(cents: unknown): number {
  const n = typeof cents === "number" ? cents : Number(cents)
  if (!Number.isFinite(n) || n <= 0) return 0
  return n / 100
}

function tipSaleAtIso(row: TipSourceRow): string {
  return row.succeeded_at ?? row.created_at
}

async function listingIdsWithConfirmedCheckout(
  supabase: SupabaseClient,
  listingIds: string[],
): Promise<Set<string>> {
  const found = new Set<string>()
  if (listingIds.length === 0) return found

  for (let i = 0; i < listingIds.length; i += ID_LOOKUP_CHUNK) {
    const chunk = listingIds.slice(i, i + ID_LOOKUP_CHUNK)
    const [ordersRes, itemsRes] = await Promise.all([
      supabase
        .from("orders")
        .select("listing_id")
        .in("listing_id", chunk)
        .eq("status", "confirmed")
        .eq("is_admin_test", false),
      supabase.from("order_items").select("listing_id, order_id").in("listing_id", chunk),
    ])

    if (ordersRes.error) {
      console.error("[sellerSaleTips] confirmed orders lookup failed", ordersRes.error)
    }
    for (const row of ordersRes.data ?? []) {
      const listingId = (row as { listing_id?: string | null }).listing_id
      if (typeof listingId === "string" && listingId) found.add(listingId)
    }

    const itemRows = itemsRes.data ?? []
    if (itemsRes.error) {
      console.error("[sellerSaleTips] confirmed order items lookup failed", itemsRes.error)
      continue
    }

    const orderIds = [
      ...new Set(
        itemRows
          .map((row) => (typeof row.order_id === "string" ? row.order_id : null))
          .filter((id): id is string => Boolean(id)),
      ),
    ]
    if (orderIds.length === 0) continue

    const confirmedOrdersRes = await supabase
      .from("orders")
      .select("id")
      .in("id", orderIds)
      .eq("status", "confirmed")
      .eq("is_admin_test", false)

    if (confirmedOrdersRes.error) {
      console.error("[sellerSaleTips] confirmed order-item orders lookup failed", confirmedOrdersRes.error)
      continue
    }

    const confirmedOrderIds = new Set(
      (confirmedOrdersRes.data ?? [])
        .map((row) => (typeof row.id === "string" ? row.id : null))
        .filter((id): id is string => Boolean(id)),
    )
    for (const row of itemRows) {
      const listingId = typeof row.listing_id === "string" ? row.listing_id : null
      const orderId = typeof row.order_id === "string" ? row.order_id : null
      if (listingId && orderId && confirmedOrderIds.has(orderId)) found.add(listingId)
    }
  }

  return found
}

async function loadSucceededTipSources(supabase: SupabaseClient): Promise<TipSourceRow[]> {
  const { data, error } = await supabase
    .from("seller_sale_tips")
    .select("listing_id, seller_user_id, amount_cents, succeeded_at, created_at")
    .eq("status", "succeeded")
    .order("created_at", { ascending: false })
    .limit(TIPS_FETCH_CAP)
  if (error) {
    console.error("[sellerSaleTips] succeeded tips load failed", error)
    return []
  }

  const rows: TipSourceRow[] = []
  for (const raw of data ?? []) {
    const row = raw as TipSourceRow
    if (typeof row.listing_id !== "string" || !row.listing_id) continue
    rows.push({
      listing_id: row.listing_id,
      seller_user_id: typeof row.seller_user_id === "string" ? row.seller_user_id : "",
      amount_cents: numPrice(row.amount_cents),
      succeeded_at: row.succeeded_at,
      created_at: row.created_at,
    })
  }
  return rows
}

async function loadListingsForTipInsights(
  supabase: SupabaseClient,
  listingIds: string[],
): Promise<Map<string, ListingGmsRow>> {
  const listingById = new Map<string, ListingGmsRow>()
  for (let i = 0; i < listingIds.length; i += ID_LOOKUP_CHUNK) {
    const chunk = listingIds.slice(i, i + ID_LOOKUP_CHUNK)
    const { data: listingRows, error: listingError } = await supabase
      .from("listings")
      .select("id, price, status, title")
      .in("id", chunk)
    if (listingError) {
      console.error("[sellerSaleTips] tipped GMS listings load failed", listingError)
      continue
    }
    for (const row of listingRows ?? []) {
      listingById.set((row as ListingGmsRow).id, row as ListingGmsRow)
    }
  }
  return listingById
}

/**
 * Succeeded seller tips plus the off-platform GMS those tips unlock.
 * Tip dollars are always platform revenue. Listing prices are GMS only when the
 * listing is sold and has no confirmed checkout (so checkout GMV is not doubled).
 */
export async function listSellerSaleTipAdminFacts(
  supabase: SupabaseClient,
): Promise<SellerSaleTipAdminFacts> {
  const tipRows = await loadSucceededTipSources(supabase)
  if (tipRows.length === 0) return { gms: [], tipRevenues: [] }

  const listingIds = [...new Set(tipRows.map((row) => row.listing_id))]
  const listingById = await loadListingsForTipInsights(supabase, listingIds)

  const tipRevenues: SellerSaleTipRevenue[] = []
  for (const tip of tipRows) {
    const listing = listingById.get(tip.listing_id)
    if (listing && ADMIN_SEED_TITLE.test(String(listing.title ?? ""))) continue
    const amountUsd = centsToUsd(tip.amount_cents)
    if (amountUsd <= 0) continue
    tipRevenues.push({
      listingId: tip.listing_id,
      amountUsd,
      succeededAt: tipSaleAtIso(tip),
    })
  }

  const earliestByListing = new Map<string, TipSourceRow>()
  for (const row of tipRows) {
    const existing = earliestByListing.get(row.listing_id)
    if (!existing) {
      earliestByListing.set(row.listing_id, { ...row })
      continue
    }
    const earlier = tipSaleAtIso(row) < tipSaleAtIso(existing) ? row : existing
    earliestByListing.set(row.listing_id, {
      ...earlier,
      amount_cents: existing.amount_cents + row.amount_cents,
    })
  }

  const confirmedIds = await listingIdsWithConfirmedCheckout(supabase, listingIds)
  const gms: TippedMarkSoldGmsContribution[] = []

  for (const [listingId, tip] of earliestByListing.entries()) {
    if (confirmedIds.has(listingId)) continue
    const listing = listingById.get(listingId)
    if (!listing || listing.status !== "sold") continue
    if (ADMIN_SEED_TITLE.test(String(listing.title ?? ""))) continue
    const listingPriceUsd = numPrice(listing.price)
    if (listingPriceUsd <= 0) continue
    if (!tip.seller_user_id) continue
    gms.push({
      listingId,
      sellerUserId: tip.seller_user_id,
      listingPriceUsd,
      tipAmountUsd: centsToUsd(tip.amount_cents),
      succeededAt: tipSaleAtIso(tip),
    })
  }

  return { gms, tipRevenues }
}

/**
 * Listing prices to add to GMS for off-platform mark-as-sold sales with a
 * succeeded seller tip. Listings that already have a confirmed checkout are
 * omitted so GMS is not double-counted.
 */
export async function listTippedMarkSoldGmsContributions(
  supabase: SupabaseClient,
): Promise<TippedMarkSoldGmsContribution[]> {
  const { gms } = await listSellerSaleTipAdminFacts(supabase)
  return gms
}

/** Succeeded tip amounts to add to platform revenue (checkout fees stay separate). */
export async function listSucceededSellerSaleTipRevenues(
  supabase: SupabaseClient,
): Promise<SellerSaleTipRevenue[]> {
  const { tipRevenues } = await listSellerSaleTipAdminFacts(supabase)
  return tipRevenues
}
