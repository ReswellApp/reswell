import type { Metadata } from "next"
import { formatCategory, LISTING_CONDITION_LABELS } from "@/lib/listing-labels"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { absolutePublicMediaUrl, absoluteUrl } from "@/lib/site-metadata"
import { STANDARD_OG_SIZE } from "@/lib/og/og-size"

const BOARD_TYPE_LABELS: Record<string, string> = {
  shortboard: "Shortboards",
  longboard: "Longboards",
  hybrid: "Hybrid",
  "mid-length": "Hybrid",
  funboard: "Hybrid",
  "step-up-gun": "Step-Up / Gun",
  "step-up": "Step-Up / Gun",
  groveler: "Groveler",
  gun: "Step-Up / Gun",
  other: "Other boards",
}

/** `listings.board_type` filter value for a `/boards?type=` query. */
export function boardTypeForDbFromBrowseParam(
  type: string | undefined | null,
): string | undefined {
  if (!type || type === "all") return undefined
  if (type === "mid-length" || type === "funboard") return "hybrid"
  if (type === "fish") return "groveler"
  if (type === "step-up" || type === "gun") return "step-up-gun"
  return type
}

/** Canonical `type=` query value for a stored `listings.board_type` (browse URLs and breadcrumbs). */
export function browseTypeParamFromBoardType(
  boardType: string | undefined | null,
): string | undefined {
  if (!boardType?.trim()) return undefined
  const t = boardType.trim()
  if (t === "funboard") return "hybrid"
  if (t === "fish") return "groveler"
  if (t === "step-up" || t === "gun") return "step-up-gun"
  return t
}

/** Display label for `/boards?type=` (used in UI breadcrumbs and metadata). */
export function boardsBrowseBoardTypeLabel(type: string | undefined | null): string | undefined {
  if (!type || type === "all") return undefined
  const key =
    type === "fish"
      ? "groveler"
      : type === "mid-length" || type === "funboard"
        ? "hybrid"
        : type === "step-up" || type === "gun"
          ? "step-up-gun"
          : type
  if (BOARD_TYPE_LABELS[key]) return BOARD_TYPE_LABELS[key]
  return type.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

const BOARDS_CONDITION_LABELS = LISTING_CONDITION_LABELS

export type BoardsBrowseSearchParams = {
  type?: string
  condition?: string
  sort?: string
  q?: string
  location?: string
  page?: string
  brand?: string
  minPrice?: string
  maxPrice?: string
  radius?: string
  lat?: string
  lng?: string
}

/** Canonical `type=` value for browse URLs, OG, and DB filters (legacy aliases → current slug). */
export function normalizedBoardsBrowseTypeFromParam(type: string | undefined | null): string | undefined {
  if (!type?.trim() || type === "all") return undefined
  if (type === "fish") return "groveler"
  if (type === "mid-length" || type === "funboard") return "hybrid"
  if (type === "step-up" || type === "gun") return "step-up-gun"
  return type.trim()
}

export async function metadataForBoardsBrowse(sp: BoardsBrowseSearchParams): Promise<Metadata> {
  const browseType = normalizedBoardsBrowseTypeFromParam(sp.type)
  const typeLabel =
    browseType ? BOARD_TYPE_LABELS[browseType] ?? "Surfboards" : "Surfboards"
  const condLabel =
    sp.condition && sp.condition !== "all"
      ? BOARDS_CONDITION_LABELS[sp.condition] ?? ""
      : ""
  const locationLabel = sp.location ? ` in ${sp.location}` : ""

  const titleParts = [condLabel, typeLabel].filter(Boolean).join(" ")
  const title = `${titleParts}${locationLabel} For Sale | Reswell`
  const description = [
    `Browse ${condLabel ? condLabel.toLowerCase() + " " : ""}${typeLabel.toLowerCase()} for sale${locationLabel}.`,
    "Find shortboards, longboards, grovelers, and more from local surfers on Reswell.",
  ].join(" ")

  const canonical = new URL("/boards", publicSiteOrigin() + "/")
  if (browseType) canonical.searchParams.set("type", browseType)
  if (sp.condition && sp.condition !== "all") canonical.searchParams.set("condition", sp.condition)
  if (sp.location) canonical.searchParams.set("location", sp.location)
  if (sp.sort && sp.sort !== "newest") canonical.searchParams.set("sort", sp.sort)

  const ogImageParams = new URLSearchParams()
  if (browseType) ogImageParams.set("type", browseType)
  const ogImagePath = `/api/og/boards${ogImageParams.size ? `?${ogImageParams.toString()}` : ""}`
  const generatedOgImageUrl = absoluteUrl(ogImagePath)

  const { getBoardsBrowseOgPayload } = await import("@/lib/boards-og-data")
  const ogPayload = await getBoardsBrowseOgPayload(sp.type)
  const listingPhotoUrl = ogPayload.ok ? absolutePublicMediaUrl(ogPayload.photoUrl) : undefined

  /** Prefer the real listing photo so link previews match inventory (layout no longer injects a default wave). */
  const shareImageUrl = listingPhotoUrl ?? generatedOgImageUrl

  return {
    title,
    description,
    alternates: { canonical: canonical.toString() },
    openGraph: {
      title,
      description,
      type: "website",
      url: canonical.toString(),
      images: [
        {
          url: shareImageUrl,
          width: listingPhotoUrl ? undefined : STANDARD_OG_SIZE.width,
          height: listingPhotoUrl ? undefined : STANDARD_OG_SIZE.height,
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

/** @internal Used by /categories and similar when a slug maps to a category name. */
export function metadataForCategoryName(categoryName: string): Metadata {
  const label = formatCategory(categoryName)
  const title = `${label} | Reswell`
  const description = `Browse ${label.toLowerCase()} on Reswell.`
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  }
}
