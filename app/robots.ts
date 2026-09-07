import type { MetadataRoute } from "next"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { getCachedSeoSettings } from "@/lib/seo/resolve-seo-settings"
import { buildRobotsRules } from "@/lib/seo/robots-rules"

/** Crawl hints + sitemap — keeps bots on public marketplace URLs, not auth-gated app shells. */
export default async function robots(): Promise<MetadataRoute.Robots> {
  const base = publicSiteOrigin()
  const settings = await getCachedSeoSettings()
  return buildRobotsRules(base, settings)
}
