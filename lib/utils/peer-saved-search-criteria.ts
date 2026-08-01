/**
 * Build saved-search criteria snapshots for peer marketplace browse pages
 * (fins, wetsuits, magazines, boardbags, …) and `/search`.
 */

import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"
import type { PeerListingSection } from "@/lib/peer-listing-sections"
import { isPeerListingSection } from "@/lib/peer-listing-sections"

function parseCommaSlugs(raw: string | undefined | null): string[] {
  if (!raw?.trim()) return []
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of raw.split(",")) {
    const slug = part.trim()
    if (!slug || slug === "all" || seen.has(slug)) continue
    seen.add(slug)
    out.push(slug)
  }
  return out
}

function parsePrice(raw: string | undefined | null): number | undefined {
  if (!raw?.trim()) return undefined
  const n = Number(raw)
  if (!Number.isFinite(n) || n < 0) return undefined
  return Math.round(n)
}

function parseYear(raw: string | undefined | null): number | undefined {
  if (!raw?.trim()) return undefined
  const n = Number(raw)
  if (!Number.isFinite(n)) return undefined
  const y = Math.round(n)
  if (y < 1900 || y > 2100) return undefined
  return y
}

/** Browse URL path for a peer section (`surfboards` → `/boards`). */
export function peerSectionBrowsePath(section: PeerListingSection): string {
  return section === "surfboards" ? "/boards" : `/${section}`
}

export function peerSavedSearchCriteriaFromBrowseParams(input: {
  section: PeerListingSection
  q?: string | null
  brand?: string | null
  condition?: string | null
  /** Fin setup / system / size, or wetsuit size (comma-separated). */
  fin?: string | null
  finSystem?: string | null
  size?: string | null
  /** Apparel category slugs (comma-separated). */
  kind?: string | null
  minPrice?: string | null
  maxPrice?: string | null
  minYear?: string | null
  maxYear?: string | null
  sort?: string | null
}): BoardSavedSearchCriteria {
  const out: BoardSavedSearchCriteria = { section: input.section }
  const q = input.q?.trim()
  if (q) out.q = q
  const brand = input.brand?.trim()
  if (brand) out.brand = brand

  const conditions = parseCommaSlugs(input.condition)
  if (conditions.length > 0) {
    out.conditions = conditions
    out.condition = conditions.join(",")
  }

  const fin = parseCommaSlugs(input.fin)
  if (fin.length > 0) out.fin = fin
  const finSystem = parseCommaSlugs(input.finSystem)
  if (finSystem.length > 0) out.finSystem = finSystem
  const sizes = parseCommaSlugs(input.size)
  if (sizes.length > 0) out.sizes = sizes
  const kinds = parseCommaSlugs(input.kind)
  if (kinds.length > 0) out.kind = kinds

  const minPrice = parsePrice(input.minPrice)
  if (minPrice != null) out.minPrice = minPrice
  const maxPrice = parsePrice(input.maxPrice)
  if (maxPrice != null) out.maxPrice = maxPrice
  const minYear = parseYear(input.minYear)
  if (minYear != null) out.minYear = minYear
  const maxYear = parseYear(input.maxYear)
  if (maxYear != null) out.maxYear = maxYear

  const sort = input.sort?.trim()
  if (sort && sort !== "newest") out.sort = sort

  return out
}

/** Marketplace `/search` keyword dead-end — match any peer section. */
export function marketplaceSearchSavedCriteria(q: string): BoardSavedSearchCriteria {
  const trimmed = q.trim()
  return {
    q: trimmed || undefined,
    anySection: true,
  }
}

export function resolveSavedSearchSection(
  criteria: BoardSavedSearchCriteria,
): PeerListingSection | "any" {
  if (criteria.anySection) return "any"
  if (isPeerListingSection(criteria.section)) return criteria.section
  return "surfboards"
}
