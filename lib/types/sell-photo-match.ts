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
  rows: SellCatalogSearchResultRow[]
}
