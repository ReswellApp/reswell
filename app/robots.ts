import type { MetadataRoute } from "next"
import { publicSiteOrigin } from "@/lib/public-site-origin"

/** Crawl hints + sitemap — keeps bots on public marketplace URLs, not auth-gated app shells. */
export default function robots(): MetadataRoute.Robots {
  const base = publicSiteOrigin()
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/admin",
        "/dashboard",
        "/messages",
        "/offers",
        "/api/",
        "/sell",
        "/auth/",
        "/cart",
        "/checkout",
        "/successpage/",
        "/favorites",
        "/following",
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  }
}
