import "server-only"
import type { Metadata } from "next"
import { managedPageBrowseSeo } from "@/lib/seo/managed-page-browse-metadata"
import { getManagedPage } from "@/lib/seo/managed-pages"
import {
  finsBrowseIndexableSnapshot,
  type FinsBrowseSearchParams,
} from "@/lib/fins-browse-metadata"

/**
 * True when extra content filters are applied — those permutations are not
 * individually managed in code, so the auto-generated title/description are kept.
 */
function finsBrowseHasContentFilters(sp: FinsBrowseSearchParams): boolean {
  return Boolean(
    (sp.condition && sp.condition !== "all") ||
      sp.q ||
      sp.brand ||
      sp.fin ||
      sp.finSystem ||
      sp.size ||
      sp.minPrice ||
      sp.maxPrice,
  )
}

/** Title, description, OG/Twitter, and robots for `/fins` (server-only — code defaults). */
export async function metadataForFinsBrowse(sp: FinsBrowseSearchParams): Promise<Metadata> {
  const { title: baseTitle, description: baseDescription, canonicalUrl } =
    finsBrowseIndexableSnapshot(sp)

  let title = baseTitle
  let description = baseDescription
  let shareImageUrl: string | undefined
  let robotsIndex = true
  let robotsFollow = true

  if (!finsBrowseHasContentFilters(sp) && getManagedPage("fins")) {
    const seo = managedPageBrowseSeo("fins", { title: baseTitle, description: baseDescription })
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
