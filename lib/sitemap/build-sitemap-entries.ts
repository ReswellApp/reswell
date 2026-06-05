import { pressArticles } from "@/lib/press-articles"
import { fetchSurfboardListingSitemapEntries } from "@/lib/db/sitemap-surfboard-listings"
import { fetchFinListingSitemapEntries } from "@/lib/db/fin-listings"
import { fetchBrandSlugRowsForSitemap } from "@/lib/db/sitemap-brands"
import { fetchSellerProfileSitemapEntries } from "@/lib/db/sitemap-seller-profiles"
import { fetchForumThreadSitemapEntries } from "@/lib/db/sitemap-forum-threads"
import { fetchSurferSlugPathsForSitemap } from "@/lib/db/sitemap-surfers"
import { fetchPublishedBlogPostSitemapEntries } from "@/lib/db/sitemap-blog-posts-published"
import { publicSiteOrigin } from "@/lib/public-site-origin"
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

/** Priority filter combos worth indexing for long-tail SEO. */
const BOARD_TYPE_FILTERS = [
  "shortboard",
  "longboard",
  "hybrid",
  "groveler",
  "fish",
  "asym",
  "step-up-gun",
]

const BOARD_CONDITION_FILTERS = ["brand_new", "excellent", "very_good", "good", "fair", "poor"]

const TOP_LOCATIONS = [
  "san-diego",
  "orange-county",
  "los-angeles",
  "santa-cruz",
  "san-francisco",
  "hawaii",
]

function boardFilterPages(now: Date): SitemapUrlEntry[] {
  const boardTypePages: SitemapUrlEntry[] = BOARD_TYPE_FILTERS.map((type) => ({
    url: `${BASE}/boards?type=${type}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }))

  const boardConditionPages: SitemapUrlEntry[] = BOARD_CONDITION_FILTERS.map((cond) => ({
    url: `${BASE}/boards?condition=${cond}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }))

  const boardTypePlusCondition: SitemapUrlEntry[] = BOARD_TYPE_FILTERS.flatMap((type) =>
    ["excellent", "very_good", "good"].map((cond) => ({
      url: `${BASE}/boards?type=${type}&condition=${cond}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  )

  const boardLocationPages: SitemapUrlEntry[] = TOP_LOCATIONS.map((loc) => ({
    url: `${BASE}/boards?location=${loc}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.7,
  }))

  const boardTypeLocationPages: SitemapUrlEntry[] = BOARD_TYPE_FILTERS.flatMap((type) =>
    TOP_LOCATIONS.map((loc) => ({
      url: `${BASE}/boards?type=${type}&location=${loc}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.6,
    })),
  )

  return [
    ...boardTypePages,
    ...boardConditionPages,
    ...boardTypePlusCondition,
    ...boardLocationPages,
    ...boardTypeLocationPages,
  ]
}

/**
 * Public hubs, policies, discovery URLs — everything except individual `/l/{listing}` rows.
 * Omits auth-gated shells (`/dashboard`, `/checkout`, `/sell`, …) per `robots.ts`.
 */
export async function buildPagesSitemapUrlEntries(): Promise<SitemapUrlEntry[]> {
  const now = new Date()
  const supabase = await supabaseForSitemapPublicRead()

  const [brandRows, sellerEntries, forumEntries, surferPaths, blogEntries] = await Promise.all([
    fetchBrandSlugRowsForSitemap(supabase),
    fetchSellerProfileSitemapEntries(supabase),
    fetchForumThreadSitemapEntries(supabase),
    fetchSurferSlugPathsForSitemap(supabase),
    fetchPublishedBlogPostSitemapEntries(supabase),
  ])

  const staticPages: SitemapUrlEntry[] = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE}/boards`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE}/fins`, lastModified: now, changeFrequency: "daily", priority: 0.8 },
    { url: `${BASE}/categories`, lastModified: now, changeFrequency: "weekly", priority: 0.65 },
    {
      url: `${BASE}/what-is-reswell`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    { url: `${BASE}/about`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${BASE}/sold`, lastModified: now, changeFrequency: "hourly", priority: 0.75 },
    { url: `${BASE}/shop`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    // Bare `/search` redirects when empty — canonical bookmark is `/search/recent`.
    { url: `${BASE}/search/recent`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/brands`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/board-talk`, lastModified: now, changeFrequency: "daily", priority: 0.5 },
    { url: `${BASE}/board-talk/reviews`, lastModified: now, changeFrequency: "daily", priority: 0.45 },
    { url: `${BASE}/jamboards`, lastModified: now, changeFrequency: "daily", priority: 0.5 },
    { url: `${BASE}/sellers`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
    { url: `${BASE}/collections`, lastModified: now, changeFrequency: "weekly", priority: 0.45 },
    { url: `${BASE}/surfers`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
    { url: `${BASE}/blog`, lastModified: now, changeFrequency: "weekly", priority: 0.45 },
    { url: `${BASE}/faq`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/contact`, lastModified: now, changeFrequency: "monthly", priority: 0.35 },
    { url: `${BASE}/shipping`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    {
      url: `${BASE}/shipping-estimator`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.35,
    },
    { url: `${BASE}/safety`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE}/return-policy`, lastModified: now, changeFrequency: "monthly", priority: 0.25 },
    { url: `${BASE}/protection-policy`, lastModified: now, changeFrequency: "monthly", priority: 0.25 },
    { url: `${BASE}/cookies`, lastModified: now, changeFrequency: "yearly", priority: 0.15 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.2 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.2 },
  ]

  const pressPages: SitemapUrlEntry[] = pressArticles.map((a) => ({
    url: `${BASE}/collections/press/${a.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: 0.35,
  }))

  const brandPages: SitemapUrlEntry[] = brandRows.map((b) => ({
    url: `${BASE}/brands/${b.slug}`,
    lastModified: now,
    changeFrequency: "weekly",
    priority: 0.55,
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

  const surferPages: SitemapUrlEntry[] = surferPaths.map((e) => ({
    url: `${BASE}${e.path}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.35,
  }))

  const blogPages: SitemapUrlEntry[] = blogEntries.map((e) => ({
    url: `${BASE}${e.path}`,
    lastModified: e.lastModified,
    changeFrequency: "monthly",
    priority: 0.4,
  }))

  const merged = [
    ...staticPages,
    ...boardFilterPages(now),
    ...pressPages,
    ...brandPages,
    ...sellerPages,
    ...forumPages,
    ...surferPages,
    ...blogPages,
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

/** Active surfboard + fin listing detail URLs (`/l/{slug-or-id}`). */
export async function buildListingSitemapUrlEntries(): Promise<SitemapUrlEntry[]> {
  const supabase = await supabaseForSitemapPublicRead()
  const [listingEntries, finEntries] = await Promise.all([
    fetchSurfboardListingSitemapEntries(supabase),
    fetchFinListingSitemapEntries(supabase),
  ])

  const normalized: { path: string; lastModified: Date }[] = [
    ...listingEntries.map((e) => ({ path: e.path, lastModified: e.lastModified })),
    ...finEntries.map((e) => ({
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
