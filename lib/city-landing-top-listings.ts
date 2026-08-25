import { compareSellersBySalesThenInventory } from "@/lib/sellers/directory-ranking"
import type { CityLandingListing } from "@/lib/types/city-landing"

/** Hide the city “top listings” row until the city has more than this many live boards. */
export const CITY_TOP_LISTINGS_MIN_COUNT = 5

/** Homepage-style strip cap. */
export const CITY_TOP_LISTINGS_LIMIT = 12

function listingHasImage(listing: CityLandingListing): boolean {
  return (listing.listing_images ?? []).some((image) => Boolean(image?.url))
}

/**
 * Boards from the city’s strongest sellers (sales, then inventory), mixed so one shop
 * does not fill the row. Empty when the city has 5 or fewer listings.
 */
export function pickCityTopSellerListings(
  listings: CityLandingListing[],
  limit = CITY_TOP_LISTINGS_LIMIT,
): CityLandingListing[] {
  if (listings.length <= CITY_TOP_LISTINGS_MIN_COUNT || limit <= 0) return []

  const bySeller = new Map<string, CityLandingListing[]>()
  for (const listing of listings) {
    const sellerListings = bySeller.get(listing.user_id) ?? []
    sellerListings.push(listing)
    bySeller.set(listing.user_id, sellerListings)
  }

  const sellers = [...bySeller.entries()].map(([id, sellerListings]) => {
    const withImages = sellerListings.filter(listingHasImage)
    const queue = withImages.length > 0 ? withImages : sellerListings
    return {
      id,
      listings: queue,
      sales_count: sellerListings[0]?.profiles?.sales_count ?? 0,
      inventoryCount: sellerListings.length,
    }
  })

  sellers.sort((a, b) =>
    compareSellersBySalesThenInventory(
      { id: a.id, sales_count: a.sales_count, inventoryCount: a.inventoryCount },
      { id: b.id, sales_count: b.sales_count, inventoryCount: b.inventoryCount },
    ),
  )

  const picked: CityLandingListing[] = []
  const nextIndex = new Map(sellers.map((seller) => [seller.id, 0]))

  while (picked.length < limit) {
    let addedThisPass = false
    for (const seller of sellers) {
      const index = nextIndex.get(seller.id) ?? 0
      const listing = seller.listings[index]
      if (!listing) continue
      picked.push(listing)
      nextIndex.set(seller.id, index + 1)
      addedThisPass = true
      if (picked.length >= limit) break
    }
    if (!addedThisPass) break
  }

  return picked
}
