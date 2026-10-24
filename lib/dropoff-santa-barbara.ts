import type { DropoffBoxRule } from "./dropoff-location-box-rules.ts"

/** Public landing for the Santa Barbara pack-and-ship dropoff. Never include the street address. */
export const SANTA_BARBARA_DROPOFF_HREF = "/dropoff/santa-barbara"
export const SANTA_BARBARA_DROPOFF_SLUG = "santa-barbara"
export const SANTA_BARBARA_DROPOFF_LOCATION_ID = "7f3c1a90-4e2b-4d8a-9f11-2c6e8b4a1d05"
export const SANTA_BARBARA_DROPOFF_PHONE_E164 = "+18054539406"
export const SANTA_BARBARA_DROPOFF_PHONE_DISPLAY = "(805) 453-9406"

/**
 * Inclusive board length (inches) for the shorter Santa Barbara carton.
 * 5'10" is 70". Anything longer uses the 86" carton.
 */
export const SANTA_BARBARA_DROPOFF_COMPACT_MAX_LENGTH_IN = 70

/**
 * Cartons kept at the Santa Barbara drop-off. First match wins.
 * 5'10" and under: 74×23×5 at 16 lb, any width.
 * 5'11" and up: 86×23×5 at 18 lb.
 * `maxLengthIn` on the long carton covers the sell-form maximum (15'11").
 */
export const SANTA_BARBARA_DROPOFF_BOX_RULES: DropoffBoxRule[] = [
  {
    id: "under-5-10",
    label: `5'10" and under`,
    minLengthIn: null,
    maxLengthIn: SANTA_BARBARA_DROPOFF_COMPACT_MAX_LENGTH_IN,
    maxWidthIn: null,
    boxLengthIn: 74,
    boxWidthIn: 23,
    boxHeightIn: 5,
    weightLb: 16,
  },
  {
    id: "5-11-and-up",
    label: `5'11" and up`,
    minLengthIn: SANTA_BARBARA_DROPOFF_COMPACT_MAX_LENGTH_IN + 0.01,
    maxLengthIn: 192,
    maxWidthIn: null,
    boxLengthIn: 86,
    boxWidthIn: 23,
    boxHeightIn: 5,
    weightLb: 18,
  },
]

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
