import type { SupabaseClient } from "@supabase/supabase-js"

function collectListingIds(rows: Array<{ listing_id?: string | null }> | null): string[] {
  const ids: string[] = []
  for (const row of rows ?? []) {
    if (typeof row.listing_id === "string" && row.listing_id) ids.push(row.listing_id)
  }
  return ids
}

/**
 * Listing ids that cannot be permanently deleted because an order, order line,
 * or return still references them (`ON DELETE RESTRICT`).
 */
export async function listingIdsBlockedFromPermanentDelete(
  supabase: SupabaseClient,
  listingIds: string[],
): Promise<Set<string>> {
  const ids = [...new Set(listingIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return new Set()

  const [ordersRes, itemsRes, returnsRes] = await Promise.all([
    supabase.from("orders").select("listing_id").in("listing_id", ids),
    supabase.from("order_items").select("listing_id").in("listing_id", ids),
    supabase.from("order_item_returns").select("listing_id").in("listing_id", ids),
  ])

  const blocked = new Set<string>()
  for (const listingId of [
    ...collectListingIds(ordersRes.data),
    ...collectListingIds(itemsRes.data),
    ...collectListingIds(returnsRes.data),
  ]) {
    blocked.add(listingId)
  }
  return blocked
}

export async function listingCanBePermanentlyDeleted(
  supabase: SupabaseClient,
  listingId: string,
): Promise<boolean> {
  const blocked = await listingIdsBlockedFromPermanentDelete(supabase, [listingId])
  return !blocked.has(listingId)
}

const OPEN_MARKETPLACE_CHECKOUT_STATUSES = ["confirmed", "refunding"] as const

type OpenCheckoutLookupResult = {
  listingIds: Set<string>
  error: boolean
}

/**
 * Listings with a live Reswell checkout (confirmed or still refunding).
 * Used to block seller Relist — only Mark as sold listings can be relisted.
 */
export async function listingIdsWithOpenMarketplaceCheckout(
  supabase: SupabaseClient,
  listingIds: string[],
): Promise<OpenCheckoutLookupResult> {
  const ids = [...new Set(listingIds.map((id) => id.trim()).filter(Boolean))]
  if (ids.length === 0) return { listingIds: new Set(), error: false }

  const [ordersRes, itemsRes] = await Promise.all([
    supabase
      .from("orders")
      .select("listing_id")
      .in("listing_id", ids)
      .in("status", [...OPEN_MARKETPLACE_CHECKOUT_STATUSES]),
    supabase.from("order_items").select("listing_id, order_id").in("listing_id", ids),
  ])

  if (ordersRes.error || itemsRes.error) {
    console.error("[listingIdsWithOpenMarketplaceCheckout]", {
      orders: ordersRes.error?.message,
      orderItems: itemsRes.error?.message,
    })
    return { listingIds: new Set(), error: true }
  }

  const found = new Set(collectListingIds(ordersRes.data))
  const itemRows = itemsRes.data ?? []
  const orderIds = [
    ...new Set(
      itemRows
        .map((row) => (typeof row.order_id === "string" ? row.order_id : null))
        .filter((id): id is string => !!id),
    ),
  ]
  if (orderIds.length === 0) return { listingIds: found, error: false }

  const openOrdersRes = await supabase
    .from("orders")
    .select("id")
    .in("id", orderIds)
    .in("status", [...OPEN_MARKETPLACE_CHECKOUT_STATUSES])

  if (openOrdersRes.error) {
    console.error("[listingIdsWithOpenMarketplaceCheckout]", {
      openOrders: openOrdersRes.error.message,
    })
    return { listingIds: new Set(), error: true }
  }

  const openOrderIds = new Set(
    (openOrdersRes.data ?? [])
      .map((row) => (typeof row.id === "string" ? row.id : null))
      .filter((id): id is string => !!id),
  )
  for (const row of itemRows) {
    if (
      typeof row.listing_id === "string" &&
      typeof row.order_id === "string" &&
      openOrderIds.has(row.order_id)
    ) {
      found.add(row.listing_id)
    }
  }
  return { listingIds: found, error: false }
}
