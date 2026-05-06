import { fetchSurfboardListingSitemapEntries } from "@/lib/db/sitemap-surfboard-listings"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { createClient, createServiceRoleClient } from "@/lib/supabase/server"

const BASE = publicSiteOrigin()

export type SitemapUrlEntry = {
  url: string
  lastModified: Date
  changeFrequency: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never"
  priority: number
}

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

/**
 * Canonical HTTP URLs for the public sitemap (unescaped `&` in query strings is correct here;
 * XML serialization must escape them — see `app/sitemap.xml/route.ts`).
 */
export async function buildSitemapUrlEntries(): Promise<SitemapUrlEntry[]> {
  const now = new Date()

  const supabase = await supabaseForSitemapPublicRead()
  const listingEntries = await fetchSurfboardListingSitemapEntries(supabase)

  const staticPages: SitemapUrlEntry[] = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE}/boards`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    {
      url: `${BASE}/what-is-reswell`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.7,
    },
    { url: `${BASE}/sold`, lastModified: now, changeFrequency: "hourly", priority: 0.75 },
    { url: `${BASE}/categories`, lastModified: now, changeFrequency: "weekly", priority: 0.65 },
    { url: `${BASE}/shop`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    // `/sell` requires auth (middleware) — omit from sitemap to avoid “indexed URL redirects” noise.
    // Bare `/search` 308s to `/search/recent` when `q` / `brandSlug` are empty — use the final URL.
    { url: `${BASE}/search/recent`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/brands`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/board-talk`, lastModified: now, changeFrequency: "daily", priority: 0.5 },
    { url: `${BASE}/sellers`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
    { url: `${BASE}/faq`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE}/safety`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.2 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.2 },
  ]

  const boardTypePages: SitemapUrlEntry[] = BOARD_TYPE_FILTERS.map((type) => ({
    url: `${BASE}/boards?type=${type}`,
    lastModified: now,
    changeFrequency: "daily",
    priority: 0.8,
  }))

  const boardConditionPages: SitemapUrlEntry[] = BOARD_CONDITION_FILTERS.map((cond) => ({
    url: `${BASE}/boards?condition=${cond}`,
    lastModified: now,
    changeFrequency: "daily",
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

  const listingPages: SitemapUrlEntry[] = listingEntries.map((e) => ({
    url: `${BASE}${e.path}`,
    lastModified: e.lastModified,
    changeFrequency: "daily",
    priority: 0.75,
  }))

  return [
    ...staticPages,
    ...boardTypePages,
    ...boardConditionPages,
    ...boardTypePlusCondition,
    ...boardLocationPages,
    ...boardTypeLocationPages,
    ...listingPages,
  ]
}
