/**
 * Title / description / canonical URL + hero copy for the /boardbags browse page.
 * Mirrors `lib/fins-browse-metadata.ts` scoped to boardbags.
 */

import { publicSiteOrigin } from "@/lib/public-site-origin"
import { LISTING_CONDITION_LABELS } from "@/lib/listing-labels"
import { boardbagSizeLabel } from "@/lib/boardbag-listing-config"

export const BOARDBAGS_BROWSE_DEFAULT_SORT = "newest" as const

/** `/boardbags` root label — matches header nav and browse breadcrumbs. */
export const boardbagsBrowseRootLabel = "All Boardbags"

export type BoardbagsBrowseSearchParams = {
  /** Free-text keyword search. */
  q?: string
  /** Multi-select condition slugs (comma-separated). */
  condition?: string
  /** Boardbag size slugs (comma-separated). */
  size?: string
  brand?: string
  minPrice?: string
  maxPrice?: string
  sort?: string
  page?: string
}

const SUPPORTED_SORTS = new Set(["newest", "price-low", "price-high"])

export function normalizedBoardbagsBrowseSort(sort: string | undefined | null): string {
  const s = sort?.trim() ?? ""
  return SUPPORTED_SORTS.has(s) ? s : BOARDBAGS_BROWSE_DEFAULT_SORT
}

/**
 * H1 / breadcrumb label when a single size filter is active; otherwise undefined.
 */
export function boardbagsBrowseFilterHeadline(sp: BoardbagsBrowseSearchParams): string | undefined {
  const sizes = (sp.size ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (sizes.length !== 1) return undefined
  const label = boardbagSizeLabel(sizes[0])
  return label ? `${label} Boardbags` : undefined
}

/** Short descriptive line under the H1 on `/boardbags`. */
export function boardbagsBrowseHeroSubtext(sp: BoardbagsBrowseSearchParams): string {
  const size = sp.size ? boardbagSizeLabel(sp.size.split(",")[0]) : null
  if (size) {
    return `${size} boardbags from surfers who ship or welcome local pickup.`
  }
  return "Steamers, springsuits, and tops from local surfers on Reswell — ship or meet up for pickup."
}

/** Title, description, and canonical URL for `/boardbags` (keep in sync with metadata). */
export function boardbagsBrowseIndexableSnapshot(sp: BoardbagsBrowseSearchParams): {
  title: string
  description: string
  canonicalUrl: string
} {
  const sizeLabel = sp.size ? boardbagSizeLabel(sp.size.split(",")[0]) : null
  const condLabel =
    sp.condition && sp.condition !== "all"
      ? (LISTING_CONDITION_LABELS[sp.condition.split(",")[0]] ?? "")
      : ""

  const noun = [sizeLabel, "Boardbags"].filter(Boolean).join(" ") || "Boardbags"
  const titleParts = [condLabel, noun].filter(Boolean).join(" ")
  const title = `${titleParts} For Sale | Reswell`
  const description = [
    `Browse ${condLabel ? condLabel.toLowerCase() + " " : ""}${noun.toLowerCase()} for sale.`,
    "Find steamers, springsuits, and tops from surfers on Reswell.",
  ].join(" ")

  const canonical = new URL("/boardbags", publicSiteOrigin() + "/")
  if (sp.size) canonical.searchParams.set("size", sp.size)
  if (sp.condition && sp.condition !== "all") canonical.searchParams.set("condition", sp.condition)
  if (sp.sort && sp.sort !== BOARDBAGS_BROWSE_DEFAULT_SORT) canonical.searchParams.set("sort", sp.sort)

  return { title, description, canonicalUrl: canonical.toString() }
}
