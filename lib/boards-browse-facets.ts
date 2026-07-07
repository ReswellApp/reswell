/**
 * Single source of truth for the surfboard browse ("pro") filter facets:
 * slugs, display labels, numeric range buckets, and URL <-> state helpers.
 *
 * Consumed by the filter UI (sidebar + mobile drawer), the DB query builder
 * (`lib/db/boards-browse-listings.ts`), the facet count service, and active chips.
 *
 * All multi-select facets are serialized to the URL as comma-separated slug lists.
 */

import { FIN_SETUP_TAG_OPTIONS } from "@/lib/listing-fin-setup-tags"
import { listingConditionFilterRows } from "@/lib/listing-labels"
import { normalizedBoardsBrowseTypeFromParam } from "@/lib/marketplace-slug-metadata"

export type FacetOption = { value: string; label: string }

export type RangeBucket = {
  /** URL slug. */
  value: string
  label: string
  /** Inclusive lower bound (null = open). */
  min: number | null
  /** Exclusive upper bound (null = open). */
  max: number | null
}

/** Board style — maps to `listings.board_type`. Mirrors the canonical board-type set. */
export const BOARD_STYLE_OPTIONS: readonly FacetOption[] = [
  { value: "shortboard", label: "Shortboard" },
  { value: "groveler", label: "Groveler" },
  { value: "fish", label: "Fish" },
  { value: "asym", label: "Asym" },
  { value: "hybrid", label: "Hybrid / Mid-Length" },
  { value: "longboard", label: "Longboard" },
  { value: "step-up-gun", label: "Step-Up / Gun" },
  { value: "other", label: "Other" },
]

/** Fin setup (layout) — multi-select against `listings.fins_setup` (comma-joined slugs). */
export const FIN_SETUP_OPTIONS: readonly FacetOption[] = FIN_SETUP_TAG_OPTIONS.map((o) => ({
  value: o.value,
  label: o.label,
}))

/** Fin system (plug/box routing) — `listings.fin_system`. */
export const FIN_SYSTEM_OPTIONS: readonly FacetOption[] = [
  { value: "futures", label: "Futures" },
  { value: "fcs_ii", label: "FCS II" },
  { value: "fcs_twin_tab", label: "FCS Twin Tab" },
  { value: "single", label: "Single Fin" },
  { value: "two_plus_one_futures", label: "2+1 (Futures Side Bites)" },
  { value: "two_plus_one_fcs", label: "2+1 (FCS Side Bites)" },
  { value: "glass_on", label: "Glass On" },
  { value: "other", label: "Other" },
]

/** Board construction — `listings.construction`. */
export const CONSTRUCTION_OPTIONS: readonly FacetOption[] = [
  { value: "eps_epoxy", label: "EPS / Epoxy" },
  { value: "pu_poly", label: "PU / Poly" },
  { value: "carbon", label: "Carbon" },
  { value: "other", label: "Other" },
]

/** Condition — multi-select against `listings.condition`. */
export const CONDITION_OPTIONS: readonly FacetOption[] = listingConditionFilterRows()

/** Length buckets (inches) — `listings.length_total_inches`. */
export const LENGTH_BUCKETS: readonly RangeBucket[] = [
  { value: "lt-5-0", label: `Under 5'0"`, min: null, max: 60 },
  { value: "5-0-5-5", label: `5'0" – 5'5"`, min: 60, max: 66 },
  { value: "5-6-5-11", label: `5'6" – 5'11"`, min: 66, max: 72 },
  { value: "6-0-6-5", label: `6'0" – 6'5"`, min: 72, max: 78 },
  { value: "6-6-6-11", label: `6'6" – 6'11"`, min: 78, max: 84 },
  { value: "7-0-7-5", label: `7'0" – 7'5"`, min: 84, max: 90 },
  { value: "7-6-7-11", label: `7'6" – 7'11"`, min: 90, max: 96 },
  { value: "8-0-8-11", label: `8'0" – 8'11"`, min: 96, max: 108 },
  { value: "9-0-plus", label: `9'0" & up`, min: 108, max: null },
]

/** Volume buckets (liters) — `listings.volume_liters`. */
export const VOLUME_BUCKETS: readonly RangeBucket[] = [
  { value: "lt-25", label: "Under 25L", min: null, max: 25 },
  { value: "25-30", label: "25L – 30L", min: 25, max: 30 },
  { value: "30-35", label: "30L – 35L", min: 30, max: 35 },
  { value: "35-40", label: "35L – 40L", min: 35, max: 40 },
  { value: "40-45", label: "40L – 45L", min: 40, max: 45 },
  { value: "45-50", label: "45L – 50L", min: 45, max: 50 },
  { value: "50-plus", label: "50L & up", min: 50, max: null },
]

/** URL query keys for the multi-select facets. */
export const FACET_PARAM_KEYS = {
  style: "style",
  condition: "condition",
  finSetup: "fin",
  finSystem: "finSystem",
  construction: "construction",
  length: "length",
  volume: "volume",
} as const

export type FacetParamKey = (typeof FACET_PARAM_KEYS)[keyof typeof FACET_PARAM_KEYS]

const LABEL_LOOKUPS: Record<string, Record<string, string>> = {
  [FACET_PARAM_KEYS.style]: optionLabelMap(BOARD_STYLE_OPTIONS),
  [FACET_PARAM_KEYS.condition]: optionLabelMap(CONDITION_OPTIONS),
  [FACET_PARAM_KEYS.finSetup]: optionLabelMap(FIN_SETUP_OPTIONS),
  [FACET_PARAM_KEYS.finSystem]: optionLabelMap(FIN_SYSTEM_OPTIONS),
  [FACET_PARAM_KEYS.construction]: optionLabelMap(CONSTRUCTION_OPTIONS),
  [FACET_PARAM_KEYS.length]: bucketLabelMap(LENGTH_BUCKETS),
  [FACET_PARAM_KEYS.volume]: bucketLabelMap(VOLUME_BUCKETS),
}

function optionLabelMap(options: readonly FacetOption[]): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.value, o.label]))
}

function bucketLabelMap(buckets: readonly RangeBucket[]): Record<string, string> {
  return Object.fromEntries(buckets.map((b) => [b.value, b.label]))
}

/** Display label for a single facet slug, or the raw slug as a fallback. */
export function facetOptionLabel(paramKey: string, value: string): string {
  return LABEL_LOOKUPS[paramKey]?.[value] ?? value
}

/** Parse a comma-separated facet param into a de-duped, allowed slug list. */
export function parseFacetParam(
  raw: string | string[] | undefined | null,
  allowed: readonly string[],
): string[] {
  if (raw == null) return []
  const joined = Array.isArray(raw) ? raw.join(",") : raw
  const allowedSet = new Set(allowed)
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of joined.split(",")) {
    const slug = part.trim()
    if (!slug || seen.has(slug) || !allowedSet.has(slug)) continue
    seen.add(slug)
    out.push(slug)
  }
  return out
}

export const FACET_ALLOWED_VALUES: Record<FacetParamKey, readonly string[]> = {
  [FACET_PARAM_KEYS.style]: BOARD_STYLE_OPTIONS.map((o) => o.value),
  [FACET_PARAM_KEYS.condition]: CONDITION_OPTIONS.map((o) => o.value),
  [FACET_PARAM_KEYS.finSetup]: FIN_SETUP_OPTIONS.map((o) => o.value),
  [FACET_PARAM_KEYS.finSystem]: FIN_SYSTEM_OPTIONS.map((o) => o.value),
  [FACET_PARAM_KEYS.construction]: CONSTRUCTION_OPTIONS.map((o) => o.value),
  [FACET_PARAM_KEYS.length]: LENGTH_BUCKETS.map((b) => b.value),
  [FACET_PARAM_KEYS.volume]: VOLUME_BUCKETS.map((b) => b.value),
}

export type BoardsBrowseFacetSelections = {
  styles: string[]
  conditions: string[]
  finSetups: string[]
  finSystems: string[]
  constructions: string[]
  lengthBuckets: string[]
  volumeBuckets: string[]
}

export const EMPTY_FACET_SELECTIONS: BoardsBrowseFacetSelections = {
  styles: [],
  conditions: [],
  finSetups: [],
  finSystems: [],
  constructions: [],
  lengthBuckets: [],
  volumeBuckets: [],
}

/** Read all facet selections from a search-params bag. */
export function facetSelectionsFromParams(sp: {
  style?: string | string[]
  condition?: string | string[]
  fin?: string | string[]
  finSystem?: string | string[]
  construction?: string | string[]
  length?: string | string[]
  volume?: string | string[]
}): BoardsBrowseFacetSelections {
  return {
    styles: parseFacetParam(sp.style, FACET_ALLOWED_VALUES.style),
    conditions: parseFacetParam(sp.condition, FACET_ALLOWED_VALUES.condition),
    finSetups: parseFacetParam(sp.fin, FACET_ALLOWED_VALUES.fin),
    finSystems: parseFacetParam(sp.finSystem, FACET_ALLOWED_VALUES.finSystem),
    constructions: parseFacetParam(sp.construction, FACET_ALLOWED_VALUES.construction),
    lengthBuckets: parseFacetParam(sp.length, FACET_ALLOWED_VALUES.length),
    volumeBuckets: parseFacetParam(sp.volume, FACET_ALLOWED_VALUES.volume),
  }
}

/**
 * Browse-aware facet selections: when the nav `type=` param is set and no explicit `style=`
 * facet is present, treat the category page as a single board-style selection.
 */
export function facetSelectionsFromBrowseParams(sp: {
  type?: string | null
  style?: string | string[]
  condition?: string | string[]
  fin?: string | string[]
  finSystem?: string | string[]
  construction?: string | string[]
  length?: string | string[]
  volume?: string | string[]
}): BoardsBrowseFacetSelections {
  const sel = facetSelectionsFromParams(sp)
  if (sel.styles.length > 0) return sel
  const navType = normalizedBoardsBrowseTypeFromParam(sp.type)
  if (!navType || !FACET_ALLOWED_VALUES.style.includes(navType)) return sel
  return { ...sel, styles: [navType] }
}

export function lengthBucketBySlug(slug: string): RangeBucket | undefined {
  return LENGTH_BUCKETS.find((b) => b.value === slug)
}

export function volumeBucketBySlug(slug: string): RangeBucket | undefined {
  return VOLUME_BUCKETS.find((b) => b.value === slug)
}

export function hasAnyFacetSelection(sel: BoardsBrowseFacetSelections): boolean {
  return (
    sel.styles.length > 0 ||
    sel.conditions.length > 0 ||
    sel.finSetups.length > 0 ||
    sel.finSystems.length > 0 ||
    sel.constructions.length > 0 ||
    sel.lengthBuckets.length > 0 ||
    sel.volumeBuckets.length > 0
  )
}
