import type { Metadata } from "next"
import { formatCategory, LISTING_CONDITION_LABELS } from "@/lib/listing-labels"
import { publicSiteOrigin } from "@/lib/public-site-origin"

const BOARD_TYPE_LABELS: Record<string, string> = {
  shortboard: "Shortboards",
  longboard: "Longboards",
  "mid-length": "Mid-lengths",
  funboard: "Mid-lengths",
  "step-up": "Step-Ups",
  fish: "Fish",
  gun: "Guns",
  other: "Other boards",
}

/** `listings.board_type` filter value for a `/boards?type=` query (DB still uses `funboard` for mid-length). */
export function boardTypeForDbFromBrowseParam(
  type: string | undefined | null,
): string | undefined {
  if (!type || type === "all") return undefined
  if (type === "mid-length") return "funboard"
  return type
}

/** Canonical `type=` query value for a stored `listings.board_type` (browse URLs and breadcrumbs). */
export function browseTypeParamFromBoardType(
  boardType: string | undefined | null,
): string | undefined {
  if (!boardType?.trim()) return undefined
  const t = boardType.trim()
  if (t === "funboard") return "mid-length"
  return t
}

/** Display label for `/boards?type=` (used in UI breadcrumbs and metadata). */
export function boardsBrowseBoardTypeLabel(type: string | undefined | null): string | undefined {
  if (!type || type === "all") return undefined
  if (BOARD_TYPE_LABELS[type]) return BOARD_TYPE_LABELS[type]
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
  const typeLabel =
    sp.type && sp.type !== "all" ? BOARD_TYPE_LABELS[sp.type] ?? "Surfboards" : "Surfboards"
  const condLabel =
    sp.condition && sp.condition !== "all"
      ? BOARDS_CONDITION_LABELS[sp.condition] ?? ""
      : ""
  const locationLabel = sp.location ? ` in ${sp.location}` : ""

  const titleParts = [condLabel, typeLabel].filter(Boolean).join(" ")
  const title = `${titleParts}${locationLabel} For Sale | Reswell`
  const description = [
    `Browse ${condLabel ? condLabel.toLowerCase() + " " : ""}${typeLabel.toLowerCase()} for sale${locationLabel}.`,
    "Find shortboards, longboards, fish, and more from local surfers on Reswell.",
  ].join(" ")

  const canonical = new URL("/boards", publicSiteOrigin() + "/")
  if (sp.type && sp.type !== "all") canonical.searchParams.set("type", sp.type)
  if (sp.condition && sp.condition !== "all") canonical.searchParams.set("condition", sp.condition)
  if (sp.location) canonical.searchParams.set("location", sp.location)
  if (sp.sort && sp.sort !== "newest") canonical.searchParams.set("sort", sp.sort)

  return {
    title,
    description,
    alternates: { canonical: canonical.toString() },
    openGraph: { title, description, type: "website" },
  }
}

/** @internal Used by /categories and similar when a slug maps to a category name. */
export function metadataForCategoryName(categoryName: string): Metadata {
  const label = formatCategory(categoryName)
  const title = `${label} | Reswell`
  const description = `Browse ${label.toLowerCase()} on Reswell.`
  return { title, description, openGraph: { title, description } }
}
