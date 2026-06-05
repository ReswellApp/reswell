/**
 * Title / description / canonical URL + hero copy for the /apparel browse page.
 * Mirrors `lib/fins-browse-metadata.ts` scoped to apparel.
 */

import { publicSiteOrigin } from "@/lib/public-site-origin"
import { LISTING_CONDITION_LABELS } from "@/lib/listing-labels"
import { apparelSizeLabel } from "@/lib/apparel-listing-config"

export const APPAREL_BROWSE_DEFAULT_SORT = "newest" as const

/** `/apparel` root label — matches header nav and browse breadcrumbs. */
export const apparelBrowseRootLabel = "All Apparel"

export type ApparelBrowseSearchParams = {
  /** Free-text keyword search. */
  q?: string
  /** Multi-select condition slugs (comma-separated). */
  condition?: string
  /** Apparel size slugs (comma-separated). */
  size?: string
  brand?: string
  minPrice?: string
  maxPrice?: string
  sort?: string
  page?: string
}

const SUPPORTED_SORTS = new Set(["newest", "price-low", "price-high"])

export function normalizedApparelBrowseSort(sort: string | undefined | null): string {
  const s = sort?.trim() ?? ""
  return SUPPORTED_SORTS.has(s) ? s : APPAREL_BROWSE_DEFAULT_SORT
}

/**
 * H1 / breadcrumb label when a single size filter is active; otherwise undefined.
 */
export function apparelBrowseFilterHeadline(sp: ApparelBrowseSearchParams): string | undefined {
  const sizes = (sp.size ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (sizes.length !== 1) return undefined
  const label = apparelSizeLabel(sizes[0])
  return label ? `${label} Apparel` : undefined
}

/** Short descriptive line under the H1 on `/apparel`. */
export function apparelBrowseHeroSubtext(sp: ApparelBrowseSearchParams): string {
  const size = sp.size ? apparelSizeLabel(sp.size.split(",")[0]) : null
  if (size) {
    return `${size} apparel from surfers who ship or welcome local pickup.`
  }
  return "Steamers, springsuits, and tops from local surfers on Reswell — ship or meet up for pickup."
}

/** Title, description, and canonical URL for `/apparel` (keep in sync with metadata). */
export function apparelBrowseIndexableSnapshot(sp: ApparelBrowseSearchParams): {
  title: string
  description: string
  canonicalUrl: string
} {
  const sizeLabel = sp.size ? apparelSizeLabel(sp.size.split(",")[0]) : null
  const condLabel =
    sp.condition && sp.condition !== "all"
      ? (LISTING_CONDITION_LABELS[sp.condition.split(",")[0]] ?? "")
      : ""

  const noun = [sizeLabel, "Apparel"].filter(Boolean).join(" ") || "Apparel"
  const titleParts = [condLabel, noun].filter(Boolean).join(" ")
  const title = `${titleParts} For Sale | Reswell`
  const description = [
    `Browse ${condLabel ? condLabel.toLowerCase() + " " : ""}${noun.toLowerCase()} for sale.`,
    "Find steamers, springsuits, and tops from surfers on Reswell.",
  ].join(" ")

  const canonical = new URL("/apparel", publicSiteOrigin() + "/")
  if (sp.size) canonical.searchParams.set("size", sp.size)
  if (sp.condition && sp.condition !== "all") canonical.searchParams.set("condition", sp.condition)
  if (sp.sort && sp.sort !== APPAREL_BROWSE_DEFAULT_SORT) canonical.searchParams.set("sort", sp.sort)

  return { title, description, canonicalUrl: canonical.toString() }
}
