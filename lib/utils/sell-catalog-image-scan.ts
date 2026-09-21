import { isJunkBrandLabel, isJunkModelLabel } from "./listing-brand-model-candidates.ts"
import {
  SELL_CATALOG_IMAGE_SCAN_CATEGORIES,
  type SellCatalogImageScanCategory,
} from "../types/sell-catalog-image-scan.ts"
import type { SellCatalogImageScanExtract } from "../validations/sellCatalogImageScan.ts"
import type { SellCatalogSearchResultRow } from "../types/sell-catalog-search.ts"
import { finCatalogSearchRowThumbUrl } from "./fin-catalog-display-image.ts"

const JUNK_VISIBLE_TOKENS = new Set([
  "used",
  "new",
  "mint",
  "condition",
  "surfboard",
  "surfboards",
  "board",
  "boards",
  "fin",
  "fins",
  "fin set",
  "logo",
  "sticker",
  "decal",
])

export function clampSellCatalogImageScanConfidence(raw: number): number {
  if (!Number.isFinite(raw)) return 0
  const ratio = raw > 1 ? raw / 100 : raw
  return Math.min(1, Math.max(0, ratio))
}

export function normalizeSellCatalogImageScanExtract(
  extract: SellCatalogImageScanExtract,
): SellCatalogImageScanExtract {
  const visibleText = extract.visibleText
    .map((token) => token.trim())
    .filter((token) => token.length > 0)
    .slice(0, 12)

  return {
    ...extract,
    brandText: extract.brandText && !isJunkBrandLabel(extract.brandText) ? extract.brandText : null,
    modelText: extract.modelText && !isJunkModelLabel(extract.modelText) ? extract.modelText : null,
    visibleText,
    confidence: clampSellCatalogImageScanConfidence(extract.confidence),
  }
}

function alreadyInLookup(lookup: string, token: string): boolean {
  const hay = lookup.toLowerCase()
  return hay.includes(token.toLowerCase())
}

function usefulVisibleToken(token: string): boolean {
  const trimmed = token.trim()
  if (trimmed.length < 3) return false
  if (JUNK_VISIBLE_TOKENS.has(trimmed.toLowerCase())) return false
  if (isJunkBrandLabel(trimmed) && isJunkModelLabel(trimmed)) return false
  return true
}

/**
 * Build the catalog search string from a vision extract.
 * Prefers brand + model; never invents tokens the model did not report.
 */
export function buildSellCatalogImageScanLookup(
  extract: SellCatalogImageScanExtract,
): string {
  const brand = extract.brandText?.trim() ?? ""
  const model = extract.modelText?.trim() ?? ""
  const named = [brand, model].filter((part) => part.length > 0).join(" ").trim()

  if (named.length >= 2) {
    if (brand && model) return named
    const extra = extract.visibleText.find(
      (token) => usefulVisibleToken(token) && !alreadyInLookup(named, token),
    )
    return extra ? `${named} ${extra}`.trim() : named
  }

  return extract.visibleText
    .filter(usefulVisibleToken)
    .slice(0, 3)
    .join(" ")
    .trim()
}

export function resolveSellCatalogImageScanCategories(
  extract: SellCatalogImageScanExtract,
): SellCatalogImageScanCategory[] {
  if (extract.category === "surfboards" || extract.category === "fins") {
    return [extract.category]
  }
  if (extract.productKind === "surfboard") return ["surfboards"]
  if (extract.productKind === "fin") return ["fins"]
  return [...SELL_CATALOG_IMAGE_SCAN_CATEGORIES]
}

export function sellCatalogImageScanRowThumb(row: SellCatalogSearchResultRow): {
  url: string | null
  isLogo: boolean
} {
  if (row.kind === "brand") {
    return { url: row.logoUrl?.trim() || null, isLogo: true }
  }
  if (row.kind === "model") {
    const image = row.imageUrl?.trim() || null
    const logo = row.brandLogoUrl?.trim() || null
    return { url: image ?? logo, isLogo: !image && Boolean(logo) }
  }
  const url = finCatalogSearchRowThumbUrl({
    kind: "variant",
    imageUrl: row.imageUrl,
    modelImageUrl: row.modelImageUrl,
    brandLogoUrl: row.brandLogoUrl,
  })
  const logo = row.brandLogoUrl?.trim() || null
  return {
    url,
    isLogo: Boolean(url && logo && url === logo),
  }
}
