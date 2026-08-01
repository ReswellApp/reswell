/**
 * Title / description / canonical URL + hero copy for the /wetsuits browse page.
 * Mirrors `lib/fins-browse-metadata.ts` scoped to wetsuits.
 */

import { publicSiteOrigin } from "@/lib/public-site-origin"
import { LISTING_CONDITION_LABELS } from "@/lib/listing-labels"
import { wetsuitSizeLabel } from "@/lib/wetsuit-listing-config"

export const WETSUITS_BROWSE_DEFAULT_SORT = "newest" as const

/** `/wetsuits` root label — matches header nav and browse breadcrumbs. */
export const wetsuitsBrowseRootLabel = "Wetsuits"

export type WetsuitsBrowseSearchParams = {
  /** Free-text keyword search. */
  q?: string
  /** Multi-select condition slugs (comma-separated). */
  condition?: string
  /** Wetsuit size slugs (comma-separated). */
  size?: string
  brand?: string
  minPrice?: string
  maxPrice?: string
  sort?: string
  page?: string
}

const SUPPORTED_SORTS = new Set(["newest", "price-low", "price-high"])

export function normalizedWetsuitsBrowseSort(sort: string | undefined | null): string {
  const s = sort?.trim() ?? ""
  return SUPPORTED_SORTS.has(s) ? s : WETSUITS_BROWSE_DEFAULT_SORT
}

/**
 * H1 / breadcrumb label when a single size filter is active; otherwise undefined.
 */
export function wetsuitsBrowseFilterHeadline(sp: WetsuitsBrowseSearchParams): string | undefined {
  const sizes = (sp.size ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (sizes.length !== 1) return undefined
  const label = wetsuitSizeLabel(sizes[0])
  return label ? `${label} Wetsuits` : undefined
}

/** Short descriptive line under the H1 on `/wetsuits`. */
export function wetsuitsBrowseHeroSubtext(sp: WetsuitsBrowseSearchParams): string {
  const size = sp.size ? wetsuitSizeLabel(sp.size.split(",")[0]) : null
  if (size) {
    return `${size} wetsuits from surfers who ship or welcome local pickup.`
  }
  return "Steamers, springsuits, and tops from local surfers on Reswell — ship or meet up for pickup."
}

/** Title, description, and canonical URL for `/wetsuits` (keep in sync with metadata). */
export function wetsuitsBrowseIndexableSnapshot(sp: WetsuitsBrowseSearchParams): {
  title: string
  description: string
  canonicalUrl: string
} {
  const sizeLabel = sp.size ? wetsuitSizeLabel(sp.size.split(",")[0]) : null
  const condLabel =
    sp.condition && sp.condition !== "all"
      ? (LISTING_CONDITION_LABELS[sp.condition.split(",")[0]] ?? "")
      : ""

  const noun = [sizeLabel, "Wetsuits"].filter(Boolean).join(" ") || "Wetsuits"
  const titleParts = [condLabel, noun].filter(Boolean).join(" ")
  const title = `${titleParts} For Sale | Reswell`
  const description = [
    `Browse ${condLabel ? condLabel.toLowerCase() + " " : ""}${noun.toLowerCase()} for sale.`,
    "Find steamers, springsuits, and tops from surfers on Reswell.",
  ].join(" ")

  const canonical = new URL("/wetsuits", publicSiteOrigin() + "/")
  if (sp.size) canonical.searchParams.set("size", sp.size)
  if (sp.condition && sp.condition !== "all") canonical.searchParams.set("condition", sp.condition)
  if (sp.sort && sp.sort !== WETSUITS_BROWSE_DEFAULT_SORT) canonical.searchParams.set("sort", sp.sort)

  return { title, description, canonicalUrl: canonical.toString() }
}
