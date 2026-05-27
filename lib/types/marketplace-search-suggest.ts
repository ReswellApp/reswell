export type SuggestListing = {
  id: string
  slug: string | null
  title: string
  price: number
  section: string
  imageUrl: string | null
  brand: string | null
  city: string | null
  state: string | null
  condition: string | null
}

export type SearchSuggestMeta = {
  /** How the “Top listings” strip was populated when suggestions ran. */
  listingsBackend: "elasticsearch" | "supabase"
}

/** Listing `brand` text plus directory logo/slug when we can resolve a `public.brands` row. */
export type SearchSuggestBrandChip = {
  listingLabel: string
  slug: string | null
  logo_url: string | null
}

export type SearchSuggestResult = {
  titles: string[]
  categories: string[]
  brands: SearchSuggestBrandChip[]
  listings: SuggestListing[]
  meta: SearchSuggestMeta
}
