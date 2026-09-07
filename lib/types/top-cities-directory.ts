export type TopCityDirectoryRow = {
  key: string
  slug: string
  label: string
  city: string
  state: string | null
  listingCount: number
  href: string
}

export type TopCitiesDirectory = {
  cities: TopCityDirectoryRow[]
  totalCities: number
  totalListings: number
}
