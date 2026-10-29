/**
 * Public `/brands` (and mobile directory) ordering.
 *
 * 1. Brands with active or sold listings attached via `listings.brand_id`
 * 2. Brands with catalog models
 * 3. More attached marketplace listings (active + sold)
 * 4. More catalog models
 * 5. Has a logo
 * 6. Name
 */

export type DirectoryBrandSortRow = {
  id: string
  name: string
  model_count: number
  logo_url: string | null
}

function listingCountFor(
  brandId: string,
  listingCounts: ReadonlyMap<string, number> | Readonly<Record<string, number>>,
): number {
  if (listingCounts instanceof Map) return listingCounts.get(brandId) ?? 0
  return listingCounts[brandId] ?? 0
}

function hasLogo(logoUrl: string | null | undefined): boolean {
  return Boolean(logoUrl?.trim())
}

export function compareDirectoryBrands(
  a: DirectoryBrandSortRow,
  b: DirectoryBrandSortRow,
  listingCounts: ReadonlyMap<string, number> | Readonly<Record<string, number>>,
): number {
  const aListings = listingCountFor(a.id, listingCounts)
  const bListings = listingCountFor(b.id, listingCounts)
  const aModels = Number.isFinite(a.model_count) ? a.model_count : 0
  const bModels = Number.isFinite(b.model_count) ? b.model_count : 0

  const aHasListings = aListings > 0 ? 1 : 0
  const bHasListings = bListings > 0 ? 1 : 0
  if (aHasListings !== bHasListings) return bHasListings - aHasListings

  const aHasModels = aModels > 0 ? 1 : 0
  const bHasModels = bModels > 0 ? 1 : 0
  if (aHasModels !== bHasModels) return bHasModels - aHasModels

  if (aListings !== bListings) return bListings - aListings
  if (aModels !== bModels) return bModels - aModels

  const aLogo = hasLogo(a.logo_url) ? 1 : 0
  const bLogo = hasLogo(b.logo_url) ? 1 : 0
  if (aLogo !== bLogo) return bLogo - aLogo

  return a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
}

export function sortDirectoryBrands<T extends DirectoryBrandSortRow>(
  brands: readonly T[],
  listingCounts: ReadonlyMap<string, number> | Readonly<Record<string, number>>,
): T[] {
  return [...brands].sort((a, b) => compareDirectoryBrands(a, b, listingCounts))
}

/** Add active + sold attached-listing counts for directory ranking. */
export function sumDirectoryListingCounts(
  active: ReadonlyMap<string, number>,
  sold: ReadonlyMap<string, number>,
): Map<string, number> {
  const out = new Map(active)
  for (const [id, n] of sold) {
    out.set(id, (out.get(id) ?? 0) + n)
  }
  return out
}
