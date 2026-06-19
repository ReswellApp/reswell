import { createServiceRoleClient } from "@/lib/supabase/server"

/**
 * Store-scoped reads of buyer offers on a store's consigned listings. Offers route to the shop owner
 * (offers.seller_id), so non-owner staff can't see them under RLS — these read via the service-role
 * client AFTER the caller is authorized as store staff.
 */

function pickCover(
  images: { url: string; is_primary: boolean | null; sort_order: number | null }[] | null,
): string | null {
  const list = images ?? []
  const cover =
    list.find((img) => img.is_primary) ??
    [...list].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))[0] ??
    null
  return cover?.url ?? null
}

export type StoreOfferListItem = {
  offerId: string
  status: string
  buyerName: string
  listingId: string
  listingTitle: string
  listingCoverUrl: string | null
  listPrice: number
  currentAmount: number
  floorPrice: number | null
  counterCount: number
  createdAt: string
}

/** Open offers (pending + countered) on this store's listings, newest first. */
export async function listStoreOffers(storeId: string): Promise<StoreOfferListItem[]> {
  const service = createServiceRoleClient()

  const { data: listingRows, error: listingErr } = await service
    .from("listings")
    .select("id, title, price, floor_price, listing_images(url, is_primary, sort_order)")
    .eq("consignment_store_id", storeId)
    .limit(1000)

  if (listingErr) {
    console.error("[storeOffers] listings:", listingErr)
    return []
  }

  type ListingRow = {
    id: string
    title: string | null
    price: number | string
    floor_price: number | string | null
    listing_images: { url: string; is_primary: boolean | null; sort_order: number | null }[] | null
  }

  const listings = (listingRows ?? []) as ListingRow[]
  if (listings.length === 0) return []
  const listingById = new Map(listings.map((l) => [l.id, l]))

  const { data: offerRows, error: offerErr } = await service
    .from("offers")
    .select(
      "id, listing_id, buyer_id, status, current_amount, counter_count, created_at, buyer:profiles!offers_buyer_id_fkey(display_name)",
    )
    .in("listing_id", Array.from(listingById.keys()))
    .in("status", ["PENDING", "COUNTERED"])
    .order("created_at", { ascending: false })
    .limit(100)

  if (offerErr) {
    console.error("[storeOffers] offers:", offerErr)
    return []
  }

  type OfferRow = {
    id: string
    listing_id: string
    status: string
    current_amount: number | string
    counter_count: number | null
    created_at: string
    buyer: { display_name: string | null } | null
  }

  return ((offerRows ?? []) as unknown as OfferRow[]).map((o) => {
    const listing = listingById.get(o.listing_id)
    return {
      offerId: o.id,
      status: o.status,
      buyerName: o.buyer?.display_name ?? "Buyer",
      listingId: o.listing_id,
      listingTitle: listing?.title ?? "Listing",
      listingCoverUrl: pickCover(listing?.listing_images ?? null),
      listPrice: listing ? Number(listing.price) : 0,
      currentAmount: Number(o.current_amount),
      floorPrice: listing?.floor_price == null ? null : Number(listing.floor_price),
      counterCount: o.counter_count ?? 0,
      createdAt: o.created_at,
    }
  })
}
