/** Tight band first; widen if marketplace is sparse so the PDP still surfaces results. */
export const PEER_SIMILAR_PRICE_BANDS: readonly { minFactor: number; maxFactor: number }[] = [
  { minFactor: 0.72, maxFactor: 1.28 },
  { minFactor: 0.58, maxFactor: 1.42 },
  { minFactor: 0.45, maxFactor: 1.65 },
]

export const PEER_SIMILAR_SECTIONS = [
  "fins",
  "traction",
  "wetsuits",
  "apparel",
  "magazines",
  "boardbags",
  "leashes",
  "surfpacks",
] as const

export type PeerSimilarSection = (typeof PEER_SIMILAR_SECTIONS)[number]

export const PEER_SIMILAR_FACET_COLUMNS = [
  "fin_system",
  "traction_size",
  "wetsuit_size",
  "apparel_kind",
  "magazine_year",
  "boardbag_size",
  "leash_size",
  "surfpack_size",
] as const

export type PeerSimilarFacetColumn = (typeof PEER_SIMILAR_FACET_COLUMNS)[number]

export function isPeerSimilarSection(section: string): section is PeerSimilarSection {
  return (PEER_SIMILAR_SECTIONS as readonly string[]).includes(section)
}

export function isPeerSimilarFacetColumn(column: string): column is PeerSimilarFacetColumn {
  return (PEER_SIMILAR_FACET_COLUMNS as readonly string[]).includes(column)
}

export function peerSimilarPriceUsd(priceUsd: number): number {
  return typeof priceUsd === "number" && Number.isFinite(priceUsd) && priceUsd > 0 ? priceUsd : 0
}

export function peerSimilarPriceRange(
  priceUsd: number,
  band: { minFactor: number; maxFactor: number },
): { low: number; high: number } {
  return {
    low: Math.max(0, Math.floor(priceUsd * band.minFactor)),
    high: Math.ceil(priceUsd * band.maxFactor),
  }
}

export function normalizePeerSimilarFacetValue(
  value: string | number | null | undefined,
): string | number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value
  if (typeof value === "string") {
    const trimmed = value.trim()
    return trimmed.length > 0 ? trimmed : null
  }
  return null
}
