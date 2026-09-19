/** Public URL base for the surfboard brands catalog. */
export const BRANDS_BASE = "/brands"

export const BRAND_PAGE_TABS = ["listings", "feed"] as const

export type BrandPageTab = (typeof BRAND_PAGE_TABS)[number]

/** Keyword search URL for surfboard listings (matches nav “View all results” style). */
export function brandKeywordSearchHref(brandDisplayName: string): string {
  const q = brandDisplayName.trim()
  if (!q) return "/search"
  const params = new URLSearchParams()
  params.set("q", q)
  return `/search?${params.toString()}`
}

export function parseBrandPageTab(raw: string | undefined): BrandPageTab {
  return raw?.trim().toLowerCase() === "feed" ? "feed" : "listings"
}

export function brandPageHref(slug: string, tab: BrandPageTab = "listings"): string {
  const path = `${BRANDS_BASE}/${slug.trim()}`
  if (tab === "feed") return `${path}?tab=feed`
  return path
}

/** Result count under the brand name (listings vs recently sold feed). */
export function brandPageResultsLabel(
  count: number,
  options: { tab: BrandPageTab; capped?: boolean },
): string {
  const n = Math.max(0, Math.floor(count))
  const formatted = `${n.toLocaleString("en-US")}${options.capped ? "+" : ""}`
  if (options.tab === "feed") return `${formatted} sold`
  return n === 1 && !options.capped ? `${formatted} result` : `${formatted} results`
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
