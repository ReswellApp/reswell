/**
 * Title / description / canonical URL + hero copy for the /apparel browse page.
 * Mirrors `lib/fins-browse-metadata.ts` scoped to apparel.
 */

import { publicSiteOrigin } from "@/lib/public-site-origin"
import { LISTING_CONDITION_LABELS } from "@/lib/listing-labels"
import { apparelKindLabel, apparelSizeLabel } from "@/lib/apparel-listing-config"

export const APPAREL_BROWSE_DEFAULT_SORT = "newest" as const

/** `/apparel` root label — matches header nav and browse breadcrumbs. */
export const apparelBrowseRootLabel = "All Apparel"

export type ApparelBrowseSearchParams = {
  /** Free-text keyword search. */
  q?: string
  /** Multi-select apparel category slugs (comma-separated). */
  kind?: string
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

function singleKindLabel(sp: ApparelBrowseSearchParams): string | null {
  const kinds = (sp.kind ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (kinds.length !== 1) return null
  return apparelKindLabel(kinds[0])
}

/**
 * H1 / breadcrumb label when a single category filter is active; otherwise undefined.
 */
export function apparelBrowseFilterHeadline(sp: ApparelBrowseSearchParams): string | undefined {
  const kindLabel = singleKindLabel(sp)
  if (kindLabel) return kindLabel

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
  const kindLabel = singleKindLabel(sp)
  if (kindLabel) {
    return `${kindLabel} from surfers who ship or welcome local pickup.`
  }
  const size = sp.size ? apparelSizeLabel(sp.size.split(",")[0]) : null
  if (size) {
    return `${size} apparel from surfers who ship or welcome local pickup.`
  }
  return "Boardshorts, hats, and t-shirts from local surfers on Reswell — ship or meet up for pickup."
}

/** Title, description, and canonical URL for `/apparel` (keep in sync with metadata). */
export function apparelBrowseIndexableSnapshot(sp: ApparelBrowseSearchParams): {
  title: string
  description: string
  canonicalUrl: string
} {
  const kindLabel = singleKindLabel(sp)
  const sizeLabel = sp.size ? apparelSizeLabel(sp.size.split(",")[0]) : null
  const condLabel =
    sp.condition && sp.condition !== "all"
      ? (LISTING_CONDITION_LABELS[sp.condition.split(",")[0]] ?? "")
      : ""

  const noun = kindLabel || [sizeLabel, "Apparel"].filter(Boolean).join(" ") || "Apparel"
  const titleParts = [condLabel, noun].filter(Boolean).join(" ")
  const title = `${titleParts} For Sale | Reswell`
  const description = [
    `Browse ${condLabel ? condLabel.toLowerCase() + " " : ""}${noun.toLowerCase()} for sale.`,
    "Find boardshorts, hats, and t-shirts from surfers on Reswell.",
  ].join(" ")

  const canonical = new URL("/apparel", publicSiteOrigin() + "/")
  if (sp.kind) canonical.searchParams.set("kind", sp.kind)
  if (sp.size) canonical.searchParams.set("size", sp.size)
  if (sp.condition && sp.condition !== "all") canonical.searchParams.set("condition", sp.condition)
  if (sp.sort && sp.sort !== APPAREL_BROWSE_DEFAULT_SORT) canonical.searchParams.set("sort", sp.sort)

  return { title, description, canonicalUrl: canonical.toString() }
}
