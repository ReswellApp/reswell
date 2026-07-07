export type NavSuggestedSurfboardsMode = "popular" | "newest"

export type NavSuggestedSurfboardPoolRow = {
  id: string
  slug: string | null
  title: string
  price: number
  views: number | null
  created_at: string
  imageUrl: string | null
  imageUrlCandidates?: string[]
}
