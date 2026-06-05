/**
 * Title / description / canonical URL + hero copy for the /leashes browse page.
 * Mirrors `lib/fins-browse-metadata.ts` scoped to leashes.
 */

import { publicSiteOrigin } from "@/lib/public-site-origin"
import { LISTING_CONDITION_LABELS } from "@/lib/listing-labels"
import { leashSizeLabel } from "@/lib/leash-listing-config"

export const LEASHES_BROWSE_DEFAULT_SORT = "newest" as const

/** `/leashes` root label — matches header nav and browse breadcrumbs. */
export const leashesBrowseRootLabel = "All Leashes"

export type LeashesBrowseSearchParams = {
  /** Free-text keyword search. */
  q?: string
  /** Multi-select condition slugs (comma-separated). */
  condition?: string
  /** Leash size slugs (comma-separated). */
  size?: string
  brand?: string
  minPrice?: string
  maxPrice?: string
  sort?: string
  page?: string
}

const SUPPORTED_SORTS = new Set(["newest", "price-low", "price-high"])

export function normalizedLeashesBrowseSort(sort: string | undefined | null): string {
  const s = sort?.trim() ?? ""
  return SUPPORTED_SORTS.has(s) ? s : LEASHES_BROWSE_DEFAULT_SORT
}

/**
 * H1 / breadcrumb label when a single size filter is active; otherwise undefined.
 */
export function leashesBrowseFilterHeadline(sp: LeashesBrowseSearchParams): string | undefined {
  const sizes = (sp.size ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (sizes.length !== 1) return undefined
  const label = leashSizeLabel(sizes[0])
  return label ? `${label} Leashes` : undefined
}

/** Short descriptive line under the H1 on `/leashes`. */
export function leashesBrowseHeroSubtext(sp: LeashesBrowseSearchParams): string {
  const size = sp.size ? leashSizeLabel(sp.size.split(",")[0]) : null
  if (size) {
    return `${size} leashes from surfers who ship or welcome local pickup.`
  }
  return "Steamers, springsuits, and tops from local surfers on Reswell — ship or meet up for pickup."
}

/** Title, description, and canonical URL for `/leashes` (keep in sync with metadata). */
export function leashesBrowseIndexableSnapshot(sp: LeashesBrowseSearchParams): {
  title: string
  description: string
  canonicalUrl: string
} {
  const sizeLabel = sp.size ? leashSizeLabel(sp.size.split(",")[0]) : null
  const condLabel =
    sp.condition && sp.condition !== "all"
      ? (LISTING_CONDITION_LABELS[sp.condition.split(",")[0]] ?? "")
      : ""

  const noun = [sizeLabel, "Leashes"].filter(Boolean).join(" ") || "Leashes"
  const titleParts = [condLabel, noun].filter(Boolean).join(" ")
  const title = `${titleParts} For Sale | Reswell`
  const description = [
    `Browse ${condLabel ? condLabel.toLowerCase() + " " : ""}${noun.toLowerCase()} for sale.`,
    "Find steamers, springsuits, and tops from surfers on Reswell.",
  ].join(" ")

  const canonical = new URL("/leashes", publicSiteOrigin() + "/")
  if (sp.size) canonical.searchParams.set("size", sp.size)
  if (sp.condition && sp.condition !== "all") canonical.searchParams.set("condition", sp.condition)
  if (sp.sort && sp.sort !== LEASHES_BROWSE_DEFAULT_SORT) canonical.searchParams.set("sort", sp.sort)

  return { title, description, canonicalUrl: canonical.toString() }
}
