import type { SellCatalogImageScanExtract } from "@/lib/validations/sellCatalogImageScan"
import type {
  SellCatalogSearchMatchTier,
  SellCatalogSearchResultRow,
} from "@/lib/types/sell-catalog-search"

export const SELL_CATALOG_IMAGE_SCAN_CATEGORIES = ["surfboards", "fins"] as const

export type SellCatalogImageScanCategory =
  (typeof SELL_CATALOG_IMAGE_SCAN_CATEGORIES)[number]

export type SellCatalogImageScanResult = {
  extract: SellCatalogImageScanExtract
  /** Catalog query built from the vision extract — empty when nothing searchable. */
  lookup: string
  matchTier: SellCatalogSearchMatchTier
  rows: SellCatalogSearchResultRow[]
}

export const SELL_CATALOG_IMAGE_SCAN_HREF = "/sell/scan"
