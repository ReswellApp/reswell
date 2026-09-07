/** Suggested paid-social / search radius around a pickup city. */
export const PICKUP_AD_RADIUS_MILES = 25

export type PickupOnlySurfboardListing = {
  id: string
  title: string
  href: string
  absoluteUrl: string
  thumbnailUrl: string | null
  price: number
  brand: string | null
  model: string | null
  conditionLabel: string | null
  boardType: string | null
  dimensions: string | null
  views: number
  createdAt: string
  daysListed: number
  city: string | null
  state: string | null
  latitude: number | null
  longitude: number | null
}

export type PickupOnlyLocality = {
  key: string
  label: string
  city: string | null
  state: string | null
  listingCount: number
  inventoryValue: number
  averagePrice: number
  averageDaysListed: number
  mappedCount: number
  latitude: number | null
  longitude: number | null
  listings: PickupOnlySurfboardListing[]
}

export type PickupOnlySurfboardsDashboard = {
  generatedAt: string
  listingCount: number
  localityCount: number
  mappedListingCount: number
  unmappedListingCount: number
  inventoryValue: number
  averagePrice: number
  adRadiusMiles: number
  localities: PickupOnlyLocality[]
  states: string[]
}
