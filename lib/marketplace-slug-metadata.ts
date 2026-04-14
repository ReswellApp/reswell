import type { Metadata } from "next"
import { formatCategory, LISTING_CONDITION_LABELS } from "@/lib/listing-labels"
import { publicSiteOrigin } from "@/lib/public-site-origin"

const BOARD_TYPE_LABELS: Record<string, string> = {
  shortboard: "Shortboards",
  longboard: "Longboards",
  hybrid: "Hybrid",
  "mid-length": "Hybrid",
  funboard: "Hybrid",
  "step-up": "Step-Ups",
  groveler: "Groveler",
  gun: "Guns",
  other: "Other boards",
}

/** `listings.board_type` filter value for a `/boards?type=` query. */
export function boardTypeForDbFromBrowseParam(
  type: string | undefined | null,
): string | undefined {
  if (!type || type === "all") return undefined
  if (type === "mid-length" || type === "funboard") return "hybrid"
  if (type === "fish") return "groveler"
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

export function metadataForBoardsBrowse(sp: BoardsBrowseSearchParams): Metadata {
  const browseType =
    sp.type && sp.type !== "all"
      ? sp.type === "fish"
        ? "groveler"
        : sp.type === "mid-length" || sp.type === "funboard"
          ? "hybrid"
          : sp.type
      : undefined
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

  return {
    title,
    description,
    alternates: { canonical: canonical.toString() },
    openGraph: { title, description, type: "website", url: canonical.toString() },
    twitter: {
      card: "summary_large_image",
      title,
      description,
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
