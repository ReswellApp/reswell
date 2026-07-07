import { publicSiteOrigin } from "@/lib/public-site-origin"
import { LISTING_CONDITION_LABELS } from "@/lib/listing-labels"

export const MAGAZINES_BROWSE_DEFAULT_SORT = "newest" as const

export const magazinesBrowseRootLabel = "All Magazines"

export type MagazinesBrowseSearchParams = {
  q?: string
  condition?: string
  brand?: string
  minPrice?: string
  maxPrice?: string
  minYear?: string
  maxYear?: string
  sort?: string
  page?: string
}

const SUPPORTED_SORTS = new Set(["newest", "price-low", "price-high"])

export function normalizedMagazinesBrowseSort(sort: string | undefined | null): string {
  const s = sort?.trim() ?? ""
  return SUPPORTED_SORTS.has(s) ? s : MAGAZINES_BROWSE_DEFAULT_SORT
}

export function magazinesBrowseFilterHeadline(
  sp: MagazinesBrowseSearchParams,
): string | undefined {
  const conditions = (sp.condition ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (conditions.length !== 1) return undefined
  const label = LISTING_CONDITION_LABELS[conditions[0]]
  return label ? `${label} Magazines` : undefined
}

export function magazinesBrowseHeroSubtext(sp: MagazinesBrowseSearchParams): string {
  const conditions = (sp.condition ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (conditions.length === 1) {
    const label = LISTING_CONDITION_LABELS[conditions[0]]
    if (label) {
      return `${label} surf magazines from sellers on Reswell — shipped to your door.`
    }
  }
  return "Vintage and collectible surf magazines from sellers on Reswell — shipped to your door."
}

export function magazinesBrowseSearchParamsKey(sp: MagazinesBrowseSearchParams): string {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(sp)) {
    if (value != null && value !== "") params.set(key, value)
  }
  return params.toString()
}

export function magazinesBrowseIndexableSnapshot(sp: MagazinesBrowseSearchParams = {}): {
  title: string
  description: string
  canonicalUrl: string
} {
  const condLabel =
    sp.condition && sp.condition !== "all"
      ? (LISTING_CONDITION_LABELS[sp.condition.split(",")[0]] ?? "")
      : ""

  const titleParts = [condLabel, "Magazines"].filter(Boolean).join(" ")
  const title = `${titleParts || "Magazines"} For Sale | Reswell`
  const description = [
    `Browse ${condLabel ? condLabel.toLowerCase() + " " : ""}surf magazines for sale.`,
    "Vintage issues and collector editions from sellers on Reswell.",
  ].join(" ")

  const canonical = new URL("/magazines", publicSiteOrigin() + "/")
  if (sp.condition && sp.condition !== "all") canonical.searchParams.set("condition", sp.condition)

  return {
    title,
    description,
    canonicalUrl: canonical.toString(),
  }
}
