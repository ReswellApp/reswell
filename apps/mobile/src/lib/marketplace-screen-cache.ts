import type {
  MobileBrowseRail,
  MobileCategory,
  MobileCategoryListingsQuery,
  MobileHome,
  MobileListingsPage,
  MobileMarketplaceFeed,
  MobileMarketplaceFeedTab,
  MobileProfile,
  MobileProfileShopFilters,
  MobileReviewsPage,
  MobileSearch,
  MobileSearchResults,
} from "@reswell/api-contract"
import { createMemoryCache } from "./memory-cache"

/**
 * Client TTLs matching public `s-maxage` on the mobile GET routes.
 * RN `fetch()` ignores those headers, so without this map the phone refetches
 * on every focus while Redis is still serving the same payload.
 */
export const MARKETPLACE_PUBLIC_GET_FRESH_MS = {
  home: 60_000,
  browseRail: 300_000,
  category: 300_000,
  categoryListings: 30_000,
  feed: 60_000,
  search: 30_000,
} as const

const homeCache = createMemoryCache<MobileHome>({
  freshMs: MARKETPLACE_PUBLIC_GET_FRESH_MS.home,
  maxSlots: 4,
})
const railCache = createMemoryCache<MobileBrowseRail>({
  freshMs: MARKETPLACE_PUBLIC_GET_FRESH_MS.browseRail,
  maxSlots: 4,
})
const feedCache = createMemoryCache<MobileMarketplaceFeed>({
  freshMs: MARKETPLACE_PUBLIC_GET_FRESH_MS.feed,
  maxSlots: 12,
})
const categoryCache = createMemoryCache<MobileCategory>({
  freshMs: MARKETPLACE_PUBLIC_GET_FRESH_MS.category,
  maxSlots: 16,
})
const categoryListingsCache = createMemoryCache<MobileListingsPage>({
  freshMs: MARKETPLACE_PUBLIC_GET_FRESH_MS.categoryListings,
  maxSlots: 24,
})
const searchCache = createMemoryCache<MobileSearchResults>({
  freshMs: MARKETPLACE_PUBLIC_GET_FRESH_MS.search,
  maxSlots: 16,
})
const searchSuggestCache = createMemoryCache<MobileSearch["listings"]>({
  freshMs: MARKETPLACE_PUBLIC_GET_FRESH_MS.search,
  maxSlots: 16,
})
const profileCache = createMemoryCache<MobileProfile>({ maxSlots: 16 })
const profileListingsCache = createMemoryCache<MobileListingsPage>({ maxSlots: 24 })
const profileFiltersCache = createMemoryCache<MobileProfileShopFilters>({ maxSlots: 16 })
const profileReviewsCache = createMemoryCache<MobileReviewsPage>({ maxSlots: 16 })

const caches = [
  homeCache,
  railCache,
  feedCache,
  categoryCache,
  categoryListingsCache,
  searchCache,
  searchSuggestCache,
  profileCache,
  profileListingsCache,
  profileFiltersCache,
  profileReviewsCache,
]

function authScope(accessToken?: string | null): string {
  return accessToken ? accessToken.slice(-12) : "anon"
}

function compactQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, " ")
}

export function categoryListingsCacheKey(
  slug: string,
  query: Partial<MobileCategoryListingsQuery> & { offset?: number },
): string {
  const params = new URLSearchParams()
  if (query.sort && query.sort !== "relevant") params.set("sort", query.sort)
  if (query.shipping) params.set("shipping", query.shipping)
  if (query.type) params.set("type", query.type)
  for (const key of [
    "style",
    "condition",
    "fin",
    "finSystem",
    "construction",
    "length",
    "volume",
    "size",
    "kind",
    "location",
    "radius",
  ] as const) {
    const value = query[key]
    if (value) params.set(key, value)
  }
  if (query.lat != null && query.lng != null) {
    params.set("lat", String(query.lat))
    params.set("lng", String(query.lng))
  }
  return `category-listings:${slug.trim().toLowerCase()}:${params.toString() || "default"}`
}

export function feedCacheKey(tab: MobileMarketplaceFeedTab, accessToken?: string | null): string {
  return `feed:${tab}:${authScope(accessToken)}`
}

function profileKey(slug: string, accessToken?: string | null): string {
  return `profile:${slug.trim().toLowerCase()}:${authScope(accessToken)}`
}

function profileListingsKey(slug: string, status: "current" | "sold", section?: string | null): string {
  return `profile-listings:${slug.trim().toLowerCase()}:${status}:${section?.trim() || "all"}`
}

export function peekHome(): MobileHome | null {
  return homeCache.peek("home")
}

export function loadHome(loader: () => Promise<MobileHome>, options?: { force?: boolean }): Promise<MobileHome> {
  return homeCache.load("home", loader, options)
}

export function peekBrowseRail(): MobileBrowseRail | null {
  return railCache.peek("browse-rail")
}

export function loadBrowseRail(
  loader: () => Promise<MobileBrowseRail>,
  options?: { force?: boolean },
): Promise<MobileBrowseRail> {
  return railCache.load("browse-rail", loader, options)
}

export function peekFeed(tab: MobileMarketplaceFeedTab, accessToken?: string | null): MobileMarketplaceFeed | null {
  return feedCache.peek(feedCacheKey(tab, accessToken))
}

export function loadFeed(
  tab: MobileMarketplaceFeedTab,
  accessToken: string | null | undefined,
  loader: () => Promise<MobileMarketplaceFeed>,
  options?: { force?: boolean },
): Promise<MobileMarketplaceFeed> {
  return feedCache.load(feedCacheKey(tab, accessToken), loader, {
    ...options,
    // Signed-in feed is `private, no-store`. Peek still paints; skip only the public GET.
    freshMs: accessToken ? 0 : MARKETPLACE_PUBLIC_GET_FRESH_MS.feed,
  })
}

export function peekCategory(slug: string): MobileCategory | null {
  if (!slug.trim()) return null
  return categoryCache.peek(`category:${slug.trim().toLowerCase()}`)
}

export function loadCategory(
  slug: string,
  loader: () => Promise<MobileCategory>,
  options?: { force?: boolean },
): Promise<MobileCategory> {
  return categoryCache.load(`category:${slug.trim().toLowerCase()}`, loader, options)
}

export function peekCategoryListings(
  slug: string,
  query: Partial<MobileCategoryListingsQuery> & { offset?: number },
): MobileListingsPage | null {
  if (!slug.trim()) return null
  return categoryListingsCache.peek(categoryListingsCacheKey(slug, query))
}

export function loadCategoryListingsPage(
  slug: string,
  query: Partial<MobileCategoryListingsQuery> & { offset?: number },
  loader: () => Promise<MobileListingsPage>,
  options?: { force?: boolean },
): Promise<MobileListingsPage> {
  return categoryListingsCache.load(categoryListingsCacheKey(slug, query), loader, options)
}

export function peekSearchResults(query: string): MobileSearchResults | null {
  const compact = compactQuery(query)
  if (compact.length < 2) return null
  return searchCache.peek(`search:${compact}`)
}

export function loadSearchResults(
  query: string,
  loader: () => Promise<MobileSearchResults>,
  options?: { force?: boolean },
): Promise<MobileSearchResults> {
  return searchCache.load(`search:${compactQuery(query)}`, loader, options)
}

export function loadSearchSuggest(
  query: string,
  loader: () => Promise<MobileSearch["listings"]>,
  options?: { force?: boolean },
): Promise<MobileSearch["listings"]> {
  const compact = compactQuery(query)
  if (compact.length < 2) return Promise.resolve([])
  return searchSuggestCache.load(`search-suggest:${compact}`, loader, options)
}

export function peekProfile(slug: string, accessToken?: string | null): MobileProfile | null {
  if (!slug.trim()) return null
  return profileCache.peek(profileKey(slug, accessToken))
}

export function loadProfile(
  slug: string,
  accessToken: string | null | undefined,
  loader: () => Promise<MobileProfile>,
  options?: { force?: boolean },
): Promise<MobileProfile> {
  return profileCache.load(profileKey(slug, accessToken), loader, options)
}

export function peekProfileListings(
  slug: string,
  status: "current" | "sold",
  section?: string | null,
): MobileListingsPage | null {
  if (!slug.trim()) return null
  return profileListingsCache.peek(profileListingsKey(slug, status, section))
}

export function loadProfileListingsPage(
  slug: string,
  status: "current" | "sold",
  section: string | null | undefined,
  loader: () => Promise<MobileListingsPage>,
  options?: { force?: boolean },
): Promise<MobileListingsPage> {
  return profileListingsCache.load(profileListingsKey(slug, status, section), loader, options)
}

export function peekProfileShopFilters(
  slug: string,
  status: "current" | "sold",
): MobileProfileShopFilters | null {
  if (!slug.trim()) return null
  return profileFiltersCache.peek(`profile-filters:${slug.trim().toLowerCase()}:${status}`)
}

export function loadProfileShopFiltersPage(
  slug: string,
  status: "current" | "sold",
  loader: () => Promise<MobileProfileShopFilters>,
  options?: { force?: boolean },
): Promise<MobileProfileShopFilters> {
  return profileFiltersCache.load(`profile-filters:${slug.trim().toLowerCase()}:${status}`, loader, options)
}

export function peekProfileReviews(slug: string): MobileReviewsPage | null {
  if (!slug.trim()) return null
  return profileReviewsCache.peek(`profile-reviews:${slug.trim().toLowerCase()}`)
}

export function loadProfileReviewsPage(
  slug: string,
  loader: () => Promise<MobileReviewsPage>,
  options?: { force?: boolean },
): Promise<MobileReviewsPage> {
  return profileReviewsCache.load(`profile-reviews:${slug.trim().toLowerCase()}`, loader, options)
}

export function clearMarketplaceScreenCache(): void {
  for (const cache of caches) cache.clear()
}
