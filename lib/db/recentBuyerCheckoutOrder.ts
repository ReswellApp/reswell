import type { SupabaseClient } from "@supabase/supabase-js"

/** Panic-retry window: same buyer + same listings should not create another PaymentIntent. */
export const RECENT_DUPLICATE_CHECKOUT_WINDOW_MS = 6 * 60 * 60 * 1000

const OPEN_CHECKOUT_STATUSES = ["confirmed", "refunding"] as const

export function checkoutListingIdsMatch(
  checkoutListingIds: readonly string[],
  orderListingIds: readonly string[],
): boolean {
  if (checkoutListingIds.length === 0 || checkoutListingIds.length !== orderListingIds.length) {
    return false
  }
  const a = [...checkoutListingIds].map((id) => id.trim()).filter(Boolean).sort()
  const b = [...orderListingIds].map((id) => id.trim()).filter(Boolean).sort()
  if (a.length !== b.length) return false
  return a.every((id, index) => id === b[index])
}

export type RecentDuplicateBuyerCheckoutOrder = {
  orderId: string
  createdAt: string
}

/**
 * Latest confirmed/refunding order this buyer placed for exactly these listings.
 * Used to stop checkout retries after a successful charge whose UI reported failure.
 */
export async function dbFindRecentDuplicateBuyerCheckoutOrder(
  supabase: SupabaseClient,
  input: {
    buyerId: string
    listingIds: readonly string[]
    nowMs?: number
  },
): Promise<RecentDuplicateBuyerCheckoutOrder | null> {
  const buyerId = input.buyerId.trim()
  const listingIds = [...new Set(input.listingIds.map((id) => id.trim()).filter(Boolean))]
  if (!buyerId || listingIds.length === 0) return null

  const sinceIso = new Date(
    (input.nowMs ?? Date.now()) - RECENT_DUPLICATE_CHECKOUT_WINDOW_MS,
  ).toISOString()

  const { data: orders, error: ordersError } = await supabase
    .from("orders")
    .select("id, listing_id, created_at, status")
    .eq("buyer_id", buyerId)
    .in("status", [...OPEN_CHECKOUT_STATUSES])
    .gte("created_at", sinceIso)
    .order("created_at", { ascending: false })
    .limit(40)

  if (ordersError) {
    console.error("[recent-duplicate-checkout] orders lookup:", ordersError.message)
    return null
  }

  const rows = (orders ?? []) as Array<{
    id?: unknown
    listing_id?: unknown
    created_at?: unknown
  }>
  const orderIds = rows
    .map((row) => (typeof row.id === "string" ? row.id : ""))
    .filter(Boolean)
  if (orderIds.length === 0) return null

  const { data: itemRows, error: itemsError } = await supabase
    .from("order_items")
    .select("order_id, listing_id")
    .in("order_id", orderIds)

  if (itemsError) {
    console.error("[recent-duplicate-checkout] order_items lookup:", itemsError.message)
  }

  const listingsByOrderId = new Map<string, string[]>()
  for (const row of itemRows ?? []) {
    const orderId = typeof row.order_id === "string" ? row.order_id : ""
    const listingId = typeof row.listing_id === "string" ? row.listing_id : ""
    if (!orderId || !listingId) continue
    const list = listingsByOrderId.get(orderId) ?? []
    list.push(listingId)
    listingsByOrderId.set(orderId, list)
  }

  for (const row of rows) {
    const orderId = typeof row.id === "string" ? row.id : ""
    if (!orderId) continue
    const fromItems = listingsByOrderId.get(orderId)
    const orderListingIds =
      fromItems && fromItems.length > 0
        ? fromItems
        : typeof row.listing_id === "string" && row.listing_id
          ? [row.listing_id]
          : []
    if (!checkoutListingIdsMatch(listingIds, orderListingIds)) continue
    const createdAt = typeof row.created_at === "string" ? row.created_at : ""
    return { orderId, createdAt }
  }

  return null
}
