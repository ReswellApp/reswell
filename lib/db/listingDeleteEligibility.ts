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
