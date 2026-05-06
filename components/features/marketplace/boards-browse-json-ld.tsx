import type { BoardsBrowseSearchParams } from "@/lib/marketplace-slug-metadata"
import { boardsBrowseIndexableSnapshot } from "@/lib/marketplace-slug-metadata"
import { publicSiteOrigin } from "@/lib/public-site-origin"

/**
 * CollectionPage JSON-LD for `/boards` — reinforces primary browse URL and page topic for crawlers.
 */
export function BoardsBrowseJsonLd({ searchParams }: { searchParams: BoardsBrowseSearchParams }) {
  const { title, description, canonicalUrl } = boardsBrowseIndexableSnapshot(searchParams)
  const origin = publicSiteOrigin()

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "CollectionPage",
    name: title,
    description,
    url: canonicalUrl,
    isPartOf: {
      "@type": "WebSite",
      name: "Reswell",
      url: origin,
    },
  }

  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
    />
  )
}
