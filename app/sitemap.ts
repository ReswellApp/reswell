import type { MetadataRoute } from "next"
import { publicSiteOrigin } from "@/lib/public-site-origin"

const BASE = publicSiteOrigin()

/** Priority filter combos worth indexing for long-tail SEO. */
const BOARD_TYPE_FILTERS = [
  "shortboard",
  "longboard",
  "hybrid",
  "step-up",
  "groveler",
  "gun",
]

const BOARD_CONDITION_FILTERS = ["new", "like_new", "good", "fair"]

const TOP_LOCATIONS = [
  "san-diego",
  "orange-county",
  "los-angeles",
  "santa-cruz",
  "san-francisco",
  "hawaii",
]

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()

  // ── Static top-level pages ──────────────────────────────────────────────────
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${BASE}/`, lastModified: now, changeFrequency: "daily", priority: 1.0 },
    { url: `${BASE}/boards`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${BASE}/feed`, lastModified: now, changeFrequency: "hourly", priority: 0.75 },
    { url: `${BASE}/categories`, lastModified: now, changeFrequency: "weekly", priority: 0.65 },
    { url: `${BASE}/shop`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${BASE}/sell`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${BASE}/search`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/brands`, lastModified: now, changeFrequency: "weekly", priority: 0.5 },
    { url: `${BASE}/board-talk`, lastModified: now, changeFrequency: "daily", priority: 0.5 },
    { url: `${BASE}/sellers`, lastModified: now, changeFrequency: "weekly", priority: 0.4 },
    { url: `${BASE}/help`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE}/safety`, lastModified: now, changeFrequency: "monthly", priority: 0.3 },
    { url: `${BASE}/terms`, lastModified: now, changeFrequency: "monthly", priority: 0.2 },
    { url: `${BASE}/privacy`, lastModified: now, changeFrequency: "monthly", priority: 0.2 },
  ]

  // ── /boards?type=X — one page per board type ────────────────────────────────
  const boardTypePages: MetadataRoute.Sitemap = BOARD_TYPE_FILTERS.map((type) => ({
    url: `${BASE}/boards?type=${type}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.8,
  }))

  // ── /boards?condition=X ─────────────────────────────────────────────────────
  const boardConditionPages: MetadataRoute.Sitemap = BOARD_CONDITION_FILTERS.map((cond) => ({
    url: `${BASE}/boards?condition=${cond}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }))

  // ── /boards?type=X&condition=used — high-value combos ───────────────────────
  const boardTypePlusCondition: MetadataRoute.Sitemap = BOARD_TYPE_FILTERS.flatMap((type) =>
    ["good", "like_new"].map((cond) => ({
      url: `${BASE}/boards?type=${type}&condition=${cond}`,
      lastModified: now,
      changeFrequency: "daily" as const,
      priority: 0.7,
    })),
  )

  // ── /boards?location=X — top surf locations ──────────────────────────────────
  const boardLocationPages: MetadataRoute.Sitemap = TOP_LOCATIONS.map((loc) => ({
    url: `${BASE}/boards?location=${loc}`,
    lastModified: now,
    changeFrequency: "daily" as const,
    priority: 0.7,
  }))

  // ── /boards?type=X&location=Y — long-tail goldmine ──────────────────────────
  const boardTypeLocationPages: MetadataRoute.Sitemap = BOARD_TYPE_FILTERS.flatMap((type) =>
    TOP_LOCATIONS.map((loc) => ({
      url: `${BASE}/boards?type=${type}&location=${loc}`,
      lastModified: now,
      changeFrequency: "weekly" as const,
      priority: 0.6,
    })),
  )

  return [
    ...staticPages,
    ...boardTypePages,
    ...boardConditionPages,
    ...boardTypePlusCondition,
    ...boardLocationPages,
    ...boardTypeLocationPages,
  ]
}
