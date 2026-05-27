/** Public URL base for the surfboard brands catalog. */
export const BRANDS_BASE = "/brands"

/** Keyword search URL for surfboard listings (matches nav “View all results” style). */
export function brandKeywordSearchHref(brandDisplayName: string): string {
  const q = brandDisplayName.trim()
  if (!q) return "/search"
  const params = new URLSearchParams()
  params.set("q", q)
  return `/search?${params.toString()}`
}

/** Active listings for a directory brand (`/search?brandSlug=`). */
export function brandActiveListingsBrowseHref(brand: { slug: string }): string {
  const slug = brand.slug.trim()
  if (!slug) return "/search"
  const params = new URLSearchParams()
  params.set("brandSlug", slug)
  return `/search?${params.toString()}`
}

/** Sold listings for a directory brand (`/sold?brandSlug=`). */
export function brandSoldListingsBrowseHref(brand: { slug: string }): string {
  const slug = brand.slug.trim()
  if (!slug) return "/sold"
  const params = new URLSearchParams()
  params.set("brandSlug", slug)
  return `/sold?${params.toString()}`
}
