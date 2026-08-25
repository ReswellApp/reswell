import type { MetadataRoute } from "next"
import { AI_CRAWLER_USER_AGENTS } from "@/lib/agent/ai-crawler-user-agents"
import type { SeoSettingsValues } from "@/lib/seo/seo-settings-cache"
import { ROBOTS_PUBLIC_ALLOW_PATHS } from "@/lib/seo/robots-public-paths"

/** Auth-gated and non-indexable app shells — shared across crawler rules. */
export const ROBOTS_BLOCKED_APP_PATHS = [
  "/admin",
  "/dashboard",
  "/messages",
  "/offers",
  "/api/",
  "/seller/",
  "/sell",
  "/import/",
  "/auth/",
  "/cart",
  "/checkout",
  "/successpage/",
  "/favorites",
  "/following",
] as const

/** Required for Google Merchant Center product + image_link crawling. */
export const GOOGLE_MERCHANT_USER_AGENTS = ["Googlebot", "Googlebot-Image", "Googlebot-image"] as const

export type RobotsSettingsInput = Pick<
  SeoSettingsValues,
  "discourageAllCrawlers" | "extraAllow" | "extraDisallow" | "crawlDelay" | "extraSitemaps"
>

export function buildRobotsRules(
  base: string,
  settings: RobotsSettingsInput,
): MetadataRoute.Robots {
  if (settings.discourageAllCrawlers) {
    return {
      rules: [{ userAgent: "*", disallow: ["/"] }],
    }
  }

  const crawlDelay = settings.crawlDelay ?? undefined
  const sitemaps = [`${base}/sitemap.xml`, ...settings.extraSitemaps]
  const allow = [...ROBOTS_PUBLIC_ALLOW_PATHS, ...settings.extraAllow]
  const merchantAllow = ["/", "/sellers", "/sellers/", "/api/public/", ...settings.extraAllow]

  return {
    rules: [
      ...GOOGLE_MERCHANT_USER_AGENTS.map((userAgent) => ({
        userAgent,
        /** Explicit `/sellers` allow — `Disallow: /sell` otherwise matches `/sellers` by prefix. */
        allow: merchantAllow,
        disallow: [...ROBOTS_BLOCKED_APP_PATHS, ...settings.extraDisallow],
      })),
      ...AI_CRAWLER_USER_AGENTS.map((userAgent) => ({
        userAgent,
        allow,
        disallow: [...ROBOTS_BLOCKED_APP_PATHS, ...settings.extraDisallow],
      })),
      {
        userAgent: "*",
        allow: [...ROBOTS_PUBLIC_ALLOW_PATHS, ...settings.extraAllow],
        disallow: [
          /** Listing photo proxy — not indexable; other crawlers stay off `/media/`. Google uses rules above. */
          "/media/",
          ...ROBOTS_BLOCKED_APP_PATHS,
          ...settings.extraDisallow,
        ],
        ...(crawlDelay !== undefined ? { crawlDelay } : {}),
      },
    ],
    sitemap: sitemaps,
  }
}
