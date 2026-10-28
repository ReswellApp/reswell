/**
 * Public `/brands` (and mobile directory) ordering.
 *
 * 1. Brands with catalog models
 * 2. Brands with at least one listing attached via `listings.brand_id`
 * 3. More attached listings (popularity)
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

  const aHasModels = aModels > 0 ? 1 : 0
  const bHasModels = bModels > 0 ? 1 : 0
  if (aHasModels !== bHasModels) return bHasModels - aHasModels

  const aHasListings = aListings > 0 ? 1 : 0
  const bHasListings = bListings > 0 ? 1 : 0
  if (aHasListings !== bHasListings) return bHasListings - aHasListings

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
