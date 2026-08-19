import type { Metadata } from "next"
import { formatCategory, LISTING_CONDITION_LABELS } from "@/lib/listing-labels"
import { publicSiteOrigin } from "@/lib/public-site-origin"

const BOARD_TYPE_LABELS: Record<string, string> = {
  shortboard: "Shortboards",
  longboard: "Longboards",
  hybrid: "Hybrid",
  "mid-length": "Hybrid",
  funboard: "Hybrid",
  "step-up-gun": "Step-Up / Gun",
  "step-up": "Step-Up / Gun",
  groveler: "Groveler",
  fish: "Fish",
  asym: "Asym",
  gun: "Step-Up / Gun",
  other: "Other boards",
}

/** `listings.board_type` filter value for a `/boards?type=` query. */
export function boardTypeForDbFromBrowseParam(
  type: string | undefined | null,
): string | undefined {
  if (!type || type === "all") return undefined
  if (type === "mid-length" || type === "funboard") return "hybrid"
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
  if (t === "step-up" || t === "gun") return "step-up-gun"
  return t
}

/** Display label for `/boards?type=` (used in UI breadcrumbs and metadata). */
export function boardsBrowseBoardTypeLabel(type: string | undefined | null): string | undefined {
  if (!type || type === "all") return undefined
  const key =
    type === "mid-length" || type === "funboard"
      ? "hybrid"
      : type === "step-up" || type === "gun"
        ? "step-up-gun"
        : type
  if (BOARD_TYPE_LABELS[key]) return BOARD_TYPE_LABELS[key]
  return type.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

const BOARDS_CONDITION_LABELS = LISTING_CONDITION_LABELS

/**
 * Default surfboards browse sort: 24h seeded shuffle of all live listings
 * (Query: `sort` omitted or `sort=top-picks`). Filtered browse uses newest instead.
 */
export const BOARDS_BROWSE_TOP_PICKS_SORT = "top-picks" as const
export const BOARDS_BROWSE_DEFAULT_SORT = BOARDS_BROWSE_TOP_PICKS_SORT
/** Newest-first browse sort (Query: `sort=newest`). */
export const BOARDS_BROWSE_NEWEST_SORT = "newest" as const

export type BoardsBrowseSearchParams = {
  type?: string
  /** Multi-select condition slugs (comma-separated). Legacy single value still honored. */
  condition?: string
  sort?: string
  q?: string
  location?: string
  page?: string
  brand?: string
  /** Directory brand id (`public.brands.id`) — exact listing filter. */
  brandId?: string
  /** Free-text model filter (matches listings.model and title). */
  model?: string
  /** Catalog model id (`public.brand_models.id`) — exact listing filter. */
  brandModelId?: string
  /** Substring match on listings.dimensions (legacy single-field filter). */
  dimensions?: string
  dimLength?: string
  dimWidth?: string
  dimThickness?: string
  dimVolume?: string
  minPrice?: string
  maxPrice?: string
  radius?: string
  lat?: string
  lng?: string
  /**
   * When `1` / `true`, only listings with `shipping_available` (seller offers shipping).
   * Omitted when the filter is off.
   */
  shipping?: string
  /** Pro facet params (comma-separated slug lists). See `lib/boards-browse-facets.ts`. */
  style?: string
  fin?: string
  finSystem?: string
  construction?: string
  length?: string
  volume?: string
}

/** True when `/boards?shipping=` requests the shipping-available filter. */
export function isBoardsBrowseShippingAvailableParam(
  value: string | undefined | null,
): boolean {
  const v = value?.trim().toLowerCase()
  return v === "1" || v === "true" || v === "yes"
}

/** Canonical `type=` value for browse URLs, OG, and DB filters (legacy aliases → current slug). */
export function normalizedBoardsBrowseTypeFromParam(type: string | undefined | null): string | undefined {
  if (!type?.trim() || type === "all") return undefined
  if (type === "mid-length" || type === "funboard") return "hybrid"
  if (type === "step-up" || type === "gun") return "step-up-gun"
  return type.trim()
}

/** Short descriptive line under the H1 on `/boards`, tailored to board category. */
export function boardsBrowseHeroSubtext(type: string | undefined | null): string {
  const canonical = normalizedBoardsBrowseTypeFromParam(type)
  if (!canonical) {
    return "Shortboards, mids, logs, and everything in between. Sellers ship when they can, and plenty are happy to meet up locally."
  }
  const lines: Record<string, string> = {
    shortboard:
      "Made for punchy waves and quick turns. Think lively boards that love steep faces and tight arcs.",
    longboard:
      "Built for glide and easy trimming. Perfect when you want long mellow rides and maybe a cheeky nose ride.",
    hybrid:
      "Extra paddle without feeling like a tank. A sweet spot when you want volume but still want to turn.",
    groveler:
      "Wide and forgiving for mushy beach breaks. Makes weak swell feel fun when you just want to surf.",
    fish:
      "Wide, flat, and fast with a split tail. Built for speed and flow in small to medium surf without feeling sluggish.",
    asym:
      "Different rails and fin setups for toe-side and heel-side. Built for riders who want an outline tuned to how they actually surf.",
    "step-up-gun":
      "Stepped up outlines for bigger days when you want drive and a steady feeling under your feet.",
    other:
      "Weird boards, customs, and shapes that do not fit a neat box. Worth a browse if you want something different.",
  }
  return lines[canonical] ?? "Used surfboards from sellers who ship or welcome local pickup."
}

/** Title, description, and canonical URL for `/boards` (keep in sync with JSON-LD and metadata). */
export function boardsBrowseIndexableSnapshot(sp: BoardsBrowseSearchParams): {
  title: string
  description: string
  canonicalUrl: string
} {
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
  if (sp.sort && sp.sort !== BOARDS_BROWSE_DEFAULT_SORT)
    canonical.searchParams.set("sort", sp.sort)

  return { title, description, canonicalUrl: canonical.toString() }
}

/** @internal Used when a slug maps to a category name. */
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
