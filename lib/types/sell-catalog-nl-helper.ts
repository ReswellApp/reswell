import type {
  SellCatalogSearchCategory,
  SellCatalogSearchResultRow,
} from "@/lib/types/sell-catalog-search"

/**
 * Response shape of `GET /api/sell/catalog-search/nl-helper`.
 * Shared between the server helper service and the `/sell` client.
 */
export type SellCatalogNlHelperResponse = {
  ok: true
  /** True when the AI was disabled, unnecessary, or failed — first results stand. */
  skipped?: boolean
  reason?: string
  /** Human-readable interpretation shown above AI-suggested rows. */
  summary: string
  applied: {
    brandText: string | null
    modelText: string | null
    category: SellCatalogSearchCategory | null
  }
  /** Catalog rows recalled from the AI-normalized brand/model text. */
  rows: SellCatalogSearchResultRow[]
}

export function emptySellCatalogNlHelperResponse(
  reason: string,
): SellCatalogNlHelperResponse {
  return {
    ok: true,
    skipped: true,
    reason,
    summary: "",
    applied: { brandText: null, modelText: null, category: null },
    rows: [],
  }
}
