import type { MetadataRoute } from "next"
import { publicSiteOrigin } from "@/lib/public-site-origin"

/** Crawl hints + sitemap — keeps bots on public marketplace URLs, not auth-gated app shells. */
export default function robots(): MetadataRoute.Robots {
  const base = publicSiteOrigin()
  return {
    rules: {
      userAgent: "*",
      /** `/sell` disallow matches `/sellers` by prefix unless explicitly allowed (Google uses longest matching rule). */
      allow: ["/sellers", "/sellers/"],
      disallow: [
        /** Listing photo proxy — not indexable; bots should use listing pages + og:image (Supabase URL). */
        "/media/",
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
      ],
    },
    sitemap: `${base}/sitemap.xml`,
  }
}
