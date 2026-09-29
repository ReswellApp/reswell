/** Public landing for the Santa Barbara pack-and-ship dropoff. Never include the street address. */
export const SANTA_BARBARA_DROPOFF_HREF = "/dropoff/santa-barbara"
export const SANTA_BARBARA_DROPOFF_SLUG = "santa-barbara"
export const SANTA_BARBARA_DROPOFF_LOCATION_ID = "7f3c1a90-4e2b-4d8a-9f11-2c6e8b4a1d05"
export const SANTA_BARBARA_DROPOFF_PHONE_E164 = "+18054539406"
export const SANTA_BARBARA_DROPOFF_PHONE_DISPLAY = "(805) 453-9406"

export const SANTA_BARBARA_DROPOFF_MAX_LENGTH = "6'6"
export const SANTA_BARBARA_DROPOFF_SHORTBOARD_MAX_WIDTH = '22"'

type SantaBarbaraDropoffListingSource = {
  dropoff_location_id?: string | null
  dropoff_locations?:
    | { slug?: string | null }
    | Array<{ slug?: string | null }>
    | null
}

/** True only when the listing explicitly saved the Santa Barbara drop-off choice. */
export function listingUsesSantaBarbaraDropoff(
  listing: SantaBarbaraDropoffListingSource | null | undefined,
): boolean {
  if (!listing) return false

  if (listing.dropoff_location_id?.trim() === SANTA_BARBARA_DROPOFF_LOCATION_ID) {
    return true
  }

  const embedded = Array.isArray(listing.dropoff_locations)
    ? listing.dropoff_locations[0]
    : listing.dropoff_locations

  return embedded?.slug?.trim().toLowerCase() === SANTA_BARBARA_DROPOFF_SLUG
}

export function listingsUseSantaBarbaraDropoff(
  listings: Array<SantaBarbaraDropoffListingSource | null | undefined>,
): boolean {
  return listings.some(listingUsesSantaBarbaraDropoff)
}

type SantaBarbaraDropoffOrderSource = {
  listings?: SantaBarbaraDropoffListingSource | SantaBarbaraDropoffListingSource[] | null
  order_items?: Array<{
    listings?: SantaBarbaraDropoffListingSource | SantaBarbaraDropoffListingSource[] | null
  }> | null
}

function firstListing(
  listings: SantaBarbaraDropoffListingSource | SantaBarbaraDropoffListingSource[] | null | undefined,
): SantaBarbaraDropoffListingSource | null {
  if (!listings) return null
  return Array.isArray(listings) ? listings[0] ?? null : listings
}

/** True when the order's listing, or any packed line, chose Santa Barbara drop-off. */
export function orderUsesSantaBarbaraDropoff(
  order: SantaBarbaraDropoffOrderSource | null | undefined,
): boolean {
  if (!order) return false
  return listingsUseSantaBarbaraDropoff([
    firstListing(order.listings),
    ...(order.order_items ?? []).map((item) => firstListing(item.listings)),
  ])
}
