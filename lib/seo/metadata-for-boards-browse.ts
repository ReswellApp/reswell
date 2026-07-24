import "server-only"
import type { Metadata } from "next"
import { absoluteUrl } from "@/lib/site-metadata"
import { STANDARD_OG_SIZE } from "@/lib/og/og-size"
import { getManagedPage } from "@/lib/seo/managed-pages"
import { managedPageBrowseSeo } from "@/lib/seo/managed-page-browse-metadata"
import {
  boardsBrowseIndexableSnapshot,
  normalizedBoardsBrowseTypeFromParam,
  type BoardsBrowseSearchParams,
} from "@/lib/marketplace-slug-metadata"

const BOARD_TYPE_LABELS: Record<string, string> = {
  shortboard: "Shortboards",
  longboard: "Longboards",
  hybrid: "Hybrid",
  groveler: "Groveler",
  fish: "Fish",
  asym: "Asym",
  "step-up-gun": "Step-Up / Gun",
  other: "Other boards",
}

/**
 * True when extra content filters are applied — those permutations are not individually
 * managed in code, so we keep the auto-generated title/description for them.
 */
function boardsBrowseHasContentFilters(sp: BoardsBrowseSearchParams): boolean {
  return Boolean(
    (sp.condition && sp.condition !== "all") ||
      sp.location ||
      sp.q ||
      sp.brand ||
      sp.brandId ||
      sp.model ||
      sp.brandModelId ||
      sp.dimensions ||
      sp.dimLength ||
      sp.dimWidth ||
      sp.dimThickness ||
      sp.dimVolume ||
      sp.minPrice ||
      sp.maxPrice ||
      sp.radius ||
      sp.shipping,
  )
}

/** Title, description, OG/Twitter, and robots for `/boards` (server-only — code defaults). */
export async function metadataForBoardsBrowse(sp: BoardsBrowseSearchParams): Promise<Metadata> {
  const { title: baseTitle, description: baseDescription, canonicalUrl } =
    boardsBrowseIndexableSnapshot(sp)
  const browseType = normalizedBoardsBrowseTypeFromParam(sp.type)
  const typeLabel =
    browseType ? BOARD_TYPE_LABELS[browseType] ?? "Surfboards" : "Surfboards"

  const ogImageParams = new URLSearchParams()
  if (browseType) ogImageParams.set("type", browseType)
  const ogImagePath = `/api/og/boards${ogImageParams.size ? `?${ogImageParams.toString()}` : ""}`
  const generatedOgImageUrl = absoluteUrl(ogImagePath)

  const { getBoardsBrowseOgPayload } = await import("@/lib/boards-og-data")
  const ogPayload = await getBoardsBrowseOgPayload(sp.type)
  const listingPhotoUrl = ogPayload.ok ? ogPayload.photoUrl : undefined

  /** Prefer the real listing photo so link previews match inventory (layout no longer injects a default wave). */
  let shareImageUrl = listingPhotoUrl ?? generatedOgImageUrl
  let title = baseTitle
  let description = baseDescription
  let robotsIndex = true
  let robotsFollow = true

  if (!boardsBrowseHasContentFilters(sp)) {
    const pageKey = browseType ? `boards:type=${browseType}` : "boards"
    if (getManagedPage(pageKey)) {
      const seo = managedPageBrowseSeo(pageKey, { title: baseTitle, description: baseDescription })
      title = seo.title
      description = seo.description
      if (seo.shareImageUrl) shareImageUrl = seo.shareImageUrl
      robotsIndex = seo.robotsIndex
      robotsFollow = seo.robotsFollow
    }
  }

  const useGeneratedImageSize = !listingPhotoUrl && shareImageUrl === generatedOgImageUrl

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
      images: [
        {
          url: shareImageUrl,
          width: useGeneratedImageSize ? STANDARD_OG_SIZE.width : undefined,
          height: useGeneratedImageSize ? STANDARD_OG_SIZE.height : undefined,
          alt: ogPayload.ok ? ogPayload.title : `${typeLabel} on Reswell`,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [shareImageUrl],
    },
  }
}
