import type { SupabaseClient } from "@supabase/supabase-js"
import {
  insertPnlEntries,
  listAttachedListingIds,
  listAttachedOrderIds,
  listHaydenShopListingsForPnl,
  type PnlEntryRow,
} from "@/lib/db/pnl"
import { haydenShopListingToPnlInsert } from "@/lib/pnl-hayden-shop-sale"

export async function attachHaydenShopActiveAndSoldListings(
  supabase: SupabaseClient,
  params: { shopUserId: string; createdBy: string },
): Promise<{ data: PnlEntryRow[]; skipped: number }> {
  const [listings, attachedListings, attachedOrders] = await Promise.all([
    listHaydenShopListingsForPnl(supabase, params.shopUserId),
    listAttachedListingIds(supabase),
    listAttachedOrderIds(supabase),
  ])

  const eligible = listings.filter((listing) => listing.status === "active" || listing.status === "sold")
  const values = eligible.flatMap((listing) => {
    if (attachedListings.has(listing.listing_id)) return []
    if (listing.order_id && attachedOrders.has(listing.order_id)) return []
    const row = haydenShopListingToPnlInsert(listing, params.createdBy)
    return row ? [row] : []
  })

  const data = await insertPnlEntries(supabase, values)
  return { data, skipped: eligible.length - values.length }
}
