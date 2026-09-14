/**
 * Title / description / canonical URL + hero copy for the /traction browse page.
 * Mirrors `lib/fins-browse-metadata.ts` scoped to traction.
 */

import { publicSiteOrigin } from "@/lib/public-site-origin"
import { LISTING_CONDITION_LABELS } from "@/lib/listing-labels"
import { tractionSizeLabel } from "@/lib/traction-listing-config"

export const TRACTION_BROWSE_DEFAULT_SORT = "newest" as const

/** `/traction` root label — matches header nav and browse breadcrumbs. */
export const tractionBrowseRootLabel = "Traction"

export type TractionBrowseSearchParams = {
  /** Free-text keyword search. */
  q?: string
  /** Multi-select condition slugs (comma-separated). */
  condition?: string
  /** Traction type slugs (comma-separated). */
  size?: string
  brand?: string
  minPrice?: string
  maxPrice?: string
  sort?: string
  page?: string
}

const SUPPORTED_SORTS = new Set(["newest", "price-low", "price-high"])

export function normalizedTractionBrowseSort(sort: string | undefined | null): string {
  const s = sort?.trim() ?? ""
  return SUPPORTED_SORTS.has(s) ? s : TRACTION_BROWSE_DEFAULT_SORT
}

/**
 * H1 / breadcrumb label when a single type filter is active; otherwise undefined.
 */
export function tractionBrowseFilterHeadline(sp: TractionBrowseSearchParams): string | undefined {
  const sizes = (sp.size ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (sizes.length !== 1) return undefined
  const label = tractionSizeLabel(sizes[0])
  return label ? `${label} Traction` : undefined
}

/** Short descriptive line under the H1 on `/traction`. */
export function tractionBrowseHeroSubtext(sp: TractionBrowseSearchParams): string {
  const size = sp.size ? tractionSizeLabel(sp.size.split(",")[0]) : null
  if (size) {
    return `${size} traction from surfers who ship or welcome local pickup.`
  }
  return "Tail pads, front pads, and deck grip from surfers on Reswell — ship or meet up for pickup."
}

/** Title, description, and canonical URL for `/traction` (keep in sync with metadata). */
export function tractionBrowseIndexableSnapshot(sp: TractionBrowseSearchParams): {
  title: string
  description: string
  canonicalUrl: string
} {
  const sizeLabel = sp.size ? tractionSizeLabel(sp.size.split(",")[0]) : null
  const condLabel =
    sp.condition && sp.condition !== "all"
      ? (LISTING_CONDITION_LABELS[sp.condition.split(",")[0]] ?? "")
      : ""

  const noun = [sizeLabel, "Traction"].filter(Boolean).join(" ") || "Traction"
  const titleParts = [condLabel, noun].filter(Boolean).join(" ")
  const title = `${titleParts} For Sale | Reswell`
  const description = [
    `Browse ${condLabel ? condLabel.toLowerCase() + " " : ""}${noun.toLowerCase()} for sale.`,
    "Find tail pads, front pads, and deck grip from surfers on Reswell.",
  ].join(" ")

  const canonical = new URL("/traction", publicSiteOrigin() + "/")
  if (sp.size) canonical.searchParams.set("size", sp.size)
  if (sp.condition && sp.condition !== "all") canonical.searchParams.set("condition", sp.condition)
  if (sp.sort && sp.sort !== TRACTION_BROWSE_DEFAULT_SORT) canonical.searchParams.set("sort", sp.sort)

  return { title, description, canonicalUrl: canonical.toString() }
}
