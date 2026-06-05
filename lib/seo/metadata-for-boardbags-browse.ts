import "server-only"
import type { Metadata } from "next"
import { metadataShareImageUrl } from "@/lib/public-media-display-src"
import { getManagedPage } from "@/lib/seo/managed-pages"
import { getPageSeoOverride } from "@/lib/seo/resolve-page-seo"
import {
  boardbagsBrowseIndexableSnapshot,
  type BoardbagsBrowseSearchParams,
} from "@/lib/boardbags-browse-metadata"

/**
 * True when extra content filters are applied — those permutations are not
 * individually editable in the SEO panel, so the auto-generated title/description
 * are kept for them.
 */
function boardbagsBrowseHasContentFilters(sp: BoardbagsBrowseSearchParams): boolean {
  return Boolean(
    (sp.condition && sp.condition !== "all") ||
      sp.q ||
      sp.brand ||
      sp.size ||
      sp.minPrice ||
      sp.maxPrice,
  )
}

/** Title, description, OG/Twitter, and robots for `/boardbags` (server-only — uses SEO overrides). */
export async function metadataForBoardbagsBrowse(sp: BoardbagsBrowseSearchParams): Promise<Metadata> {
  const { title: baseTitle, description: baseDescription, canonicalUrl } =
    boardbagsBrowseIndexableSnapshot(sp)

  let title = baseTitle
  let description = baseDescription
  let shareImageUrl: string | undefined
  let robotsIndex = true
  let robotsFollow = true

  if (!boardbagsBrowseHasContentFilters(sp)) {
    if (getManagedPage("boardbags")) {
      const ov = await getPageSeoOverride("boardbags")
      if (ov.title?.trim()) title = ov.title.trim()
      if (ov.description?.trim()) description = ov.description.trim()
      const overrideImage = ov.ogImageUrl?.trim()
      if (overrideImage) shareImageUrl = metadataShareImageUrl(overrideImage)
      if (typeof ov.robotsIndex === "boolean") robotsIndex = ov.robotsIndex
      if (typeof ov.robotsFollow === "boolean") robotsFollow = ov.robotsFollow
    }
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
