import type { MetadataRoute } from "next"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { getCachedSeoSettings } from "@/lib/seo/resolve-seo-settings"

/** Auth-gated and non-indexable app shells — shared across crawler rules. */
const BLOCKED_APP_PATHS = [
  "/admin",
  "/dashboard",
  "/messages",
  "/offers",
  "/api/",
  "/seller/",
  "/sell",
  "/auth/",
  "/cart",
  "/checkout",
  "/successpage/",
  "/favorites",
  "/following",
] as const

/** Required for Google Merchant Center product + image_link crawling. */
const GOOGLE_MERCHANT_USER_AGENTS = ["Googlebot", "Googlebot-Image", "Googlebot-image"] as const

/** Crawl hints + sitemap — keeps bots on public marketplace URLs, not auth-gated app shells. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = publicSiteOrigin()
  const settings = await getCachedSeoSettings()

  // Kill switch: block every crawler (e.g. staging) and skip the sitemap.
  if (settings.discourageAllCrawlers) {
    return {
      rules: [{ userAgent: "*", disallow: ["/"] }],
    }
  }

  const crawlDelay = settings.crawlDelay ?? undefined
  const sitemaps = [`${base}/sitemap.xml`, ...settings.extraSitemaps]

  return {
    rules: [
      ...GOOGLE_MERCHANT_USER_AGENTS.map((userAgent) => ({
        userAgent,
        /** Explicit `/sellers` allow — `Disallow: /sell` otherwise matches `/sellers` by prefix. */
        allow: ["/", "/sellers", "/sellers/", ...settings.extraAllow],
        disallow: [...BLOCKED_APP_PATHS, ...settings.extraDisallow],
      })),
      {
        userAgent: "*",
        allow: ["/sellers", "/sellers/", ...settings.extraAllow],
        disallow: [
          /** Listing photo proxy — not indexable; other crawlers stay off `/media/`. Google uses rules above. */
          "/media/",
          ...BLOCKED_APP_PATHS,
          ...settings.extraDisallow,
        ],
        ...(crawlDelay !== undefined ? { crawlDelay } : {}),
      },
    ],
    sitemap: sitemaps,
  }
}
