/**
 * Title / description / canonical URL + hero copy for the /fins browse page.
 * Mirrors `lib/marketplace-slug-metadata.ts` (surfboards) scoped to fins.
 */

import { publicSiteOrigin } from "@/lib/public-site-origin"
import { LISTING_CONDITION_LABELS } from "@/lib/listing-labels"
import { finSetupLabel, finSystemLabel } from "@/lib/fin-listing-config"

export const FINS_BROWSE_DEFAULT_SORT = "newest" as const

/** `/fins` root label — matches header nav and browse breadcrumbs. */
export const finsBrowseRootLabel = "Fins"

export type FinsBrowseSearchParams = {
  /** Free-text keyword search. */
  q?: string
  /** Multi-select condition slugs (comma-separated). */
  condition?: string
  /** Fin layout slugs (comma-separated). */
  fin?: string
  /** Fin system slugs (comma-separated). */
  finSystem?: string
  /** Fin size slugs (comma-separated). */
  size?: string
  brand?: string
  minPrice?: string
  maxPrice?: string
  sort?: string
  page?: string
}

const SUPPORTED_SORTS = new Set(["newest", "price-low", "price-high"])

export function normalizedFinsBrowseSort(sort: string | undefined | null): string {
  const s = sort?.trim() ?? ""
  return SUPPORTED_SORTS.has(s) ? s : FINS_BROWSE_DEFAULT_SORT
}

/**
 * H1 / breadcrumb label when a single fin-setup filter is active; otherwise undefined.
 */
export function finsBrowseFilterHeadline(sp: FinsBrowseSearchParams): string | undefined {
  const setups = (sp.fin ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
  if (setups.length !== 1) return undefined
  return finSetupLabel(setups[0]) ?? undefined
}

/** Short descriptive line under the H1 on `/fins`. */
export function finsBrowseHeroSubtext(sp: FinsBrowseSearchParams): string {
  const setup = sp.fin ? finSetupLabel(sp.fin.split(",")[0]) : null
  const system = sp.finSystem ? finSystemLabel(sp.finSystem.split(",")[0]) : null
  if (setup && system) {
    return `${setup} ${system} fins from surfers who ship or welcome local pickup.`
  }
  if (system) {
    return `${system} fins from surfers who ship or welcome local pickup.`
  }
  if (setup) {
    return `${setup} fin sets from surfers who ship or welcome local pickup.`
  }
  return "Thrusters, quads, twins, and singles in every system — Futures, FCS, glass-on, and more — from surfers on Reswell."
}

/** Title, description, and canonical URL for `/fins` (keep in sync with metadata). */
export function finsBrowseIndexableSnapshot(sp: FinsBrowseSearchParams): {
  title: string
  description: string
  canonicalUrl: string
} {
  const setupLabel = sp.fin ? finSetupLabel(sp.fin.split(",")[0]) : null
  const systemLabel = sp.finSystem ? finSystemLabel(sp.finSystem.split(",")[0]) : null
  const condLabel =
    sp.condition && sp.condition !== "all"
      ? (LISTING_CONDITION_LABELS[sp.condition.split(",")[0]] ?? "")
      : ""

  const noun = [setupLabel, systemLabel].filter(Boolean).join(" ") || "Surfboard Fins"
  const titleParts = [condLabel, noun].filter(Boolean).join(" ")
  const title = `${titleParts} For Sale | Reswell`
  const description = [
    `Browse ${condLabel ? condLabel.toLowerCase() + " " : ""}${noun.toLowerCase()} for sale.`,
    "Find thrusters, quads, twins, and singles in Futures, FCS, and more from surfers on Reswell.",
  ].join(" ")

  const canonical = new URL("/fins", publicSiteOrigin() + "/")
  if (sp.fin) canonical.searchParams.set("fin", sp.fin)
  if (sp.finSystem) canonical.searchParams.set("finSystem", sp.finSystem)
  if (sp.size) canonical.searchParams.set("size", sp.size)
  if (sp.condition && sp.condition !== "all") canonical.searchParams.set("condition", sp.condition)
  if (sp.sort && sp.sort !== FINS_BROWSE_DEFAULT_SORT) canonical.searchParams.set("sort", sp.sort)

  return { title, description, canonicalUrl: canonical.toString() }
}
