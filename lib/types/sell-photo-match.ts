import type {
  SellCatalogSearchMatchTier,
  SellCatalogSearchResultRow,
} from "@/lib/types/sell-catalog-search"
import type { SellPhotoObservation } from "@/lib/validations/sellPhotoMatch"

export type SellPhotoMatchResponse = {
  observation: SellPhotoObservation
  /** Query actually sent to catalog search. Null when the photo had no readable name. */
  lookupQuery: string | null
  matchTier: SellCatalogSearchMatchTier
  /** Elasticsearch sell-catalog index, or the database fallback when that index has no hits. */
  catalogBackend: "elasticsearch" | "supabase" | null
  /** True when Gemini Embedding 2 nearest-neighbor hits were part of the result. */
  usedEmbedding: boolean
  rows: SellCatalogSearchResultRow[]
}

export type SellPhotoLiveListingImage = {
  id: string
  url: string
  sortOrder: number
}

/** Active surfboard listing the admin can pick photos from. Brand and model are the saved listing fields, not the match. */
export type SellPhotoLiveListing = {
  id: string
  title: string
  brand: string | null
  model: string | null
  images: SellPhotoLiveListingImage[]
}
