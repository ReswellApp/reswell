export type NavSearchPersonalizationBrand = {
  id: string
  slug: string
  name: string
  logoUrl: string | null
}

export type NavSearchPersonalizationListing = {
  id: string
  slug: string | null
  title: string
  price: number
  imageUrl: string | null
}

export type NavSearchPersonalization = {
  recentSearches: string[]
  recentlyViewed: NavSearchPersonalizationListing[]
  recentlyViewedBrands: NavSearchPersonalizationBrand[]
}
