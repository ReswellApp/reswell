import { fetchSurfboardListingSitemapEntries } from "@/lib/db/sitemap-surfboard-listings"
import { fetchFinListingSitemapEntries } from "@/lib/db/fin-listings"
import { fetchWetsuitListingSitemapEntries } from "@/lib/db/wetsuit-listings"
import { fetchBoardbagListingSitemapEntries } from "@/lib/db/boardbag-listings"
import { fetchSurfpackListingSitemapEntries } from "@/lib/db/surfpack-listings"
import { fetchLeashListingSitemapEntries } from "@/lib/db/leash-listings"
import { fetchApparelListingSitemapEntries } from "@/lib/db/apparel-listings"
import { fetchAccessoryListingSitemapEntries } from "@/lib/db/accessory-listings"
import { fetchMagazineListingSitemapEntries } from "@/lib/db/magazine-listings"
import { fetchBrandSlugRowsForSitemap } from "@/lib/db/sitemap-brands"
import { fetchSellerProfileSitemapEntries } from "@/lib/db/sitemap-seller-profiles"
import { fetchForumThreadSitemapEntries } from "@/lib/db/sitemap-forum-threads"
import { fetchPublishedBlogPostSitemapEntries } from "@/lib/db/sitemap-blog-posts-published"
import { fetchPriceGuideSitemapPaths } from "@/lib/db/sitemap-price-guide"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { getCachedTopCitiesDirectory } from "@/lib/cache/top-cities-directory"
import { cityLandingHref } from "@/lib/city-landing-path"
import { CITY_SURF_SHOPS, surfShopHref } from "@/lib/city-landing-surf-shops"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"
import { getNoindexManagedPaths } from "@/lib/seo/resolve-page-seo"
import type { SitemapUrlEntry } from "@/lib/sitemap/types"

export type { SitemapUrlEntry } from "@/lib/sitemap/types"

const BASE = publicSiteOrigin()

async function supabaseForSitemapPublicRead() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return createServiceRoleClient()
  }
  return createClient()
}

/**
 * Board browse URLs worth submitting in the sitemap.
 *
 * Keep single-dimension filters (type, location) and a short list of high-intent
 * type+location pairs. Omit condition-only and type+condition URLs — they multiply
 * near-duplicate pages and dilute crawl budget without meaningful search demand.
 */
const BOARD_TYPE_FILTERS = [
  "shortboard",
  "longboard",
  "hybrid",
  "groveler",
  "fish",
  "asym",
  "step-up-gun",
] as const

const TOP_LOCATIONS = [
  "san-diego",
  "orange-county",
  "los-angeles",
  "santa-cruz",
  "san-francisco",
  "hawaii",
] as const

/** Niche board types only need a type-only URL; skip location cross-products. */
const BOARD_TYPE_LOCATION_COMBOS: Readonly<
  Record<(typeof BOARD_TYPE_FILTERS)[number], readonly (typeof TOP_LOCATIONS)[number][]>
> = {
  shortboard: TOP_LOCATIONS,
  longboard: TOP_LOCATIONS,
  fish: ["san-diego", "orange-county", "los-angeles", "hawaii"],
  hybrid: ["san-diego", "orange-county", "los-angeles", "santa-cruz", "san-francisco"],
  groveler: ["san-diego", "orange-county", "los-angeles"],
  asym: [],
  "step-up-gun": [],
}

function boardFilterPages(now: Date): SitemapUrlEntry[] {
  const boardTypePages: SitemapUrlEntry[] = BOARD_TYPE_FILTERS.map((type) => ({
    url: `${BASE}/boards?type=${type}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }))

  const boardLocationPages: SitemapUrlEntry[] = TOP_LOCATIONS.map((loc) => ({
    url: `${BASE}/boards?location=${loc}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.7,
  }))

  const boardTypeLocationPages: SitemapUrlEntry[] = BOARD_TYPE_FILTERS.flatMap((type) =>
    BOARD_TYPE_LOCATION_COMBOS[type].map((loc) => ({
      url: `${BASE}/boards?type=${type}&location=${loc}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    })),
  )

  return [...boardTypePages, ...boardLocationPages, ...boardTypeLocationPages]
}

/**
 * Public hubs, policies, discovery URLs — everything except individual `/l/{listing}` rows.
 * Omits auth-gated shells (`/dashboard`, `/checkout`, `/sell`, …) per `robots.ts`.
 */
export async function buildPagesSitemapUrlEntries(): Promise<SitemapUrlEntry[]> {
  const now = new Date()
  const supabase = await supabaseForSitemapPublicRead()

  const [brandRows, sellerEntries, forumEntries, blogEntries, priceGuidePaths, cityDirectory] =
    await Promise.all([
      fetchBrandSlugRowsForSitemap(supabase),
      fetchSellerProfileSitemapEntries(supabase),
      fetchForumThreadSitemapEntries(supabase),
      fetchPublishedBlogPostSitemapEntries(supabase),
      fetchPriceGuideSitemapPaths(supabase),
      getCachedTopCitiesDirectory(),
    ])

  const staticPages: SitemapUrlEntry[] = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE}/boards`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE}/fins`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/wetsuits`, lastModified: now, changeFrequency: "daily", priority: 0.75 },
    { url: `${BASE}/boardbags`, lastModified: now, changeFrequency: "daily", priority: 0.75 },
    { url: `${BASE}/surfpacks`, lastModified: now, changeFrequency: "daily", priority: 0.75 },
    { url: `${BASE}/leashes`, lastModified: now, changeFrequency: "daily", priority: 0.75 },
    { url: `${BASE}/apparel`, lastModified: now, changeFrequency: "daily", priority: 0.75 },
    { url: `${BASE}/accessories`, lastModified: now, changeFrequency: "daily", priority: 0.75 },
    { url: `${BASE}/magazines`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    {
      url: `${BASE}/what-is-reswell`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    { url: `${BASE}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/sold`, lastModified: now, changeFrequency: "hourly", priority: 0.75 },
    // Bare `/search` redirects when empty — canonical bookmark is `/search/recent`.
    { url: `${BASE}/search/recent`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/brands`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/threads`, lastModified: now, changeFrequency: "daily", priority: 0.5 },
    { url: `${BASE}/threads/reviews`, lastModified: now, changeFrequency: "daily", priority: 0.45 },
    { url: `${BASE}/jamboards`, lastModified: now, changeFrequency: "daily", priority: 0.5 },
    { url: `${BASE}/sellers`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
    { url: `${BASE}/cities/top`, lastModified: now, changeFrequency: "daily", priority: 0.55 },
    { url: `${BASE}/surf-shops`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/priceguide`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/giveaways`, lastModified: now, changeFrequency: "weekly", priority: 0.55 },
    { url: `${BASE}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.45 },
    { url: `${BASE}/faq`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/public-api`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/llms.txt`, lastModified: now, changeFrequency: "monthly", priority: 0.35 },
    { url: `${BASE}/openapi.json`, lastModified: now, changeFrequency: "monthly", priority: 0.4 },
    { url: `${BASE}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.35 },
    { url: `${BASE}/careers`, lastModified: now, changeFrequency: "monthly", priority: 0.35 },
    { url: `${BASE}/shipping`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    {
      url: `${BASE}/shipping-estimator`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.35,
    },
    { url: `${BASE}/safety`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    // Policy/legal pages stay indexable via footer links — omit from sitemap to save crawl budget.
  ]

  const brandPages: SitemapUrlEntry[] = brandRows.map((b) => ({
    url: `${BASE}/brands/${b.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.55,
  }))

  const cityPages: SitemapUrlEntry[] = cityDirectory.cities.map((city) => ({
    url: `${BASE}${cityLandingHref(city.slug)}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.6,
  }))

  const surfShopPages: SitemapUrlEntry[] = CITY_SURF_SHOPS.map((shop) => ({
    url: `${BASE}${surfShopHref(shop.slug)}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.5,
  }))

  const sellerPages: SitemapUrlEntry[] = sellerEntries.map((e) => ({
    url: `${BASE}${e.path}`,
    lastModified: e.lastModified,
    changeFrequency: "weekly",
    priority: 0.5,
  }))

  const forumPages: SitemapUrlEntry[] = forumEntries.map((e) => ({
    url: `${BASE}${e.path}`,
    lastModified: e.lastModified,
    changeFrequency: "weekly",
    priority: 0.35,
  }))

  const blogPages: SitemapUrlEntry[] = blogEntries.map((e) => ({
    url: `${BASE}${e.path}`,
    lastModified: e.lastModified,
    changeFrequency: "monthly",
    priority: 0.4,
  }))

  const priceGuidePages: SitemapUrlEntry[] = priceGuidePaths.map((e) => ({
    url: `${BASE}${e.path}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: e.path === "/priceguide" ? 0.7 : 0.55,
  }))

  const merged = [
    ...staticPages,
    ...boardFilterPages(now),
    ...brandPages,
    ...cityPages,
    ...surfShopPages,
    ...sellerPages,
    ...forumPages,
    ...blogPages,
    ...priceGuidePages,
  ]

  // Drop any managed page the admin flipped to no-index in the SEO panel.
  const noindexPaths = await getNoindexManagedPaths()

  const seen = new Set<string>()
  const deduped: SitemapUrlEntry[] = []
  for (const entry of merged) {
    if (seen.has(entry.url)) continue
    if (noindexPaths.size > 0) {
      const pathname = entry.url.slice(BASE.length).split("?")[0].replace(/\/+$/, "") || "/"
      if (noindexPaths.has(pathname)) continue
    }
    seen.add(entry.url)
    deduped.push(entry)
  }

  return deduped
}

/** Active peer listing detail URLs (`/l/{slug-or-id}`). */
export async function buildListingSitemapUrlEntries(): Promise<SitemapUrlEntry[]> {
  const supabase = await supabaseForSitemapPublicRead()
  const [
    listingEntries,
    finEntries,
    wetsuitEntries,
    boardbagEntries,
    surfpackEntries,
    leashEntries,
    apparelEntries,
    accessoryEntries,
    magazineEntries,
  ] = await Promise.all([
    fetchSurfboardListingSitemapEntries(supabase),
    fetchFinListingSitemapEntries(supabase),
    fetchWetsuitListingSitemapEntries(supabase),
    fetchBoardbagListingSitemapEntries(supabase),
    fetchSurfpackListingSitemapEntries(supabase),
    fetchLeashListingSitemapEntries(supabase),
    fetchApparelListingSitemapEntries(supabase),
    fetchAccessoryListingSitemapEntries(supabase),
    fetchMagazineListingSitemapEntries(supabase),
  ])

  const peerEntries = [
    ...finEntries,
    ...wetsuitEntries,
    ...boardbagEntries,
    ...surfpackEntries,
    ...leashEntries,
    ...apparelEntries,
    ...accessoryEntries,
    ...magazineEntries,
  ]

  const normalized: { path: string; lastModified: Date }[] = [
    ...listingEntries.map((e) => ({ path: e.path, lastModified: e.lastModified })),
    ...peerEntries.map((e) => ({
      path: e.path,
      lastModified: e.updatedAt ? new Date(e.updatedAt) : new Date(),
    })),
  ]

  const seen = new Set<string>()
  const entries: SitemapUrlEntry[] = []
  for (const e of normalized) {
    const url = `${BASE}${e.path}`
    if (seen.has(url)) continue
    seen.add(url)
    entries.push({
      url,
      lastModified: e.lastModified,
      changeFrequency: "daily",
      priority: 0.75,
    })
  }
  return entries
}
