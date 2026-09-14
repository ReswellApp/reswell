/**
 * Browse filter facets for the /traction marketplace page. Mirrors
 * `lib/fins-browse-facets.ts` scoped to the attributes that matter for traction:
 * size and condition.
 *
 * All multi-select facets serialize to the URL as comma-separated slug lists.
 */

import {
  TRACTION_SIZE_OPTIONS,
  type TractionFacetOption,
} from "@/lib/traction-listing-config"
import { listingConditionFilterRows } from "@/lib/listing-labels"

export type { TractionFacetOption } from "@/lib/traction-listing-config"

/** Condition — multi-select against `listings.condition`. */
export const TRACTION_CONDITION_OPTIONS: readonly TractionFacetOption[] = listingConditionFilterRows()

/** URL query keys for the multi-select facets. */
export const TRACTION_FACET_PARAM_KEYS = {
  size: "size",
  condition: "condition",
} as const

export type TractionFacetParamKey =
  (typeof TRACTION_FACET_PARAM_KEYS)[keyof typeof TRACTION_FACET_PARAM_KEYS]

const LABEL_LOOKUPS: Record<string, Record<string, string>> = {
  [TRACTION_FACET_PARAM_KEYS.size]: optionLabelMap(TRACTION_SIZE_OPTIONS),
  [TRACTION_FACET_PARAM_KEYS.condition]: optionLabelMap(TRACTION_CONDITION_OPTIONS),
}

function optionLabelMap(options: readonly TractionFacetOption[]): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.value, o.label]))
}

/** Display label for a single facet slug, or the raw slug as a fallback. */
export function tractionFacetOptionLabel(paramKey: string, value: string): string {
  return LABEL_LOOKUPS[paramKey]?.[value] ?? value
}

/** Parse a comma-separated facet param into a de-duped, allowed slug list. */
export function parseTractionFacetParam(
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

export const TRACTION_FACET_ALLOWED_VALUES: Record<TractionFacetParamKey, readonly string[]> = {
  [TRACTION_FACET_PARAM_KEYS.size]: TRACTION_SIZE_OPTIONS.map((o) => o.value),
  [TRACTION_FACET_PARAM_KEYS.condition]: TRACTION_CONDITION_OPTIONS.map((o) => o.value),
}

export type TractionBrowseFacetSelections = {
  sizes: string[]
  conditions: string[]
}

export const EMPTY_TRACTION_FACET_SELECTIONS: TractionBrowseFacetSelections = {
  sizes: [],
  conditions: [],
}

/** Read all facet selections from a search-params bag. */
export function tractionFacetSelectionsFromParams(sp: {
  size?: string | string[]
  condition?: string | string[]
}): TractionBrowseFacetSelections {
  return {
    sizes: parseTractionFacetParam(sp.size, TRACTION_FACET_ALLOWED_VALUES.size),
    conditions: parseTractionFacetParam(sp.condition, TRACTION_FACET_ALLOWED_VALUES.condition),
  }
}

export function hasAnyTractionFacetSelection(sel: TractionBrowseFacetSelections): boolean {
  return sel.sizes.length > 0 || sel.conditions.length > 0
}
