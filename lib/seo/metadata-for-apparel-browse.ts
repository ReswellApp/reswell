import "server-only"
import type { Metadata } from "next"
import { managedPageBrowseSeo } from "@/lib/seo/managed-page-browse-metadata"
import { getManagedPage } from "@/lib/seo/managed-pages"
import {
  apparelBrowseIndexableSnapshot,
  type ApparelBrowseSearchParams,
} from "@/lib/apparel-browse-metadata"

function apparelBrowseHasContentFilters(sp: ApparelBrowseSearchParams): boolean {
  return Boolean(
    (sp.condition && sp.condition !== "all") ||
      sp.q ||
      sp.brand ||
      sp.size ||
      sp.minPrice ||
      sp.maxPrice,
  )
}

/** Title, description, OG/Twitter, and robots for `/apparel` (server-only — code defaults). */
export async function metadataForApparelBrowse(sp: ApparelBrowseSearchParams): Promise<Metadata> {
  const { title: baseTitle, description: baseDescription, canonicalUrl } =
    apparelBrowseIndexableSnapshot(sp)

  let title = baseTitle
  let description = baseDescription
  let shareImageUrl: string | undefined
  let robotsIndex = true
  let robotsFollow = true

  if (!apparelBrowseHasContentFilters(sp) && getManagedPage("apparel")) {
    const seo = managedPageBrowseSeo("apparel", { title: baseTitle, description: baseDescription })
    title = seo.title
    description = seo.description
    shareImageUrl = seo.shareImageUrl
    robotsIndex = seo.robotsIndex
    robotsFollow = seo.robotsFollow
  }

  return {
    title,
    description,
    robots: {
      index: robotsIndex,
      follow: robotsFollow,
      googleBot: { index: robotsIndex, follow: robotsFollow },
    },
    alternates: { canonical: canonicalUrl },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonicalUrl,
      ...(shareImageUrl ? { images: [{ url: shareImageUrl, alt: title }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      ...(shareImageUrl ? { images: [shareImageUrl] } : {}),
    },
  }
}
