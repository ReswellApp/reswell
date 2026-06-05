/**
 * Browse filter facets for the /leashes marketplace page. Mirrors
 * `lib/fins-browse-facets.ts` scoped to the attributes that matter for leashes:
 * size and condition.
 *
 * All multi-select facets serialize to the URL as comma-separated slug lists.
 */

import {
  LEASH_SIZE_OPTIONS,
  type LeashFacetOption,
} from "@/lib/leash-listing-config"
import { listingConditionFilterRows } from "@/lib/listing-labels"

export type { LeashFacetOption } from "@/lib/leash-listing-config"

/** Condition — multi-select against `listings.condition`. */
export const LEASH_CONDITION_OPTIONS: readonly LeashFacetOption[] = listingConditionFilterRows()

/** URL query keys for the multi-select facets. */
export const LEASH_FACET_PARAM_KEYS = {
  size: "size",
  condition: "condition",
} as const

export type LeashFacetParamKey =
  (typeof LEASH_FACET_PARAM_KEYS)[keyof typeof LEASH_FACET_PARAM_KEYS]

const LABEL_LOOKUPS: Record<string, Record<string, string>> = {
  [LEASH_FACET_PARAM_KEYS.size]: optionLabelMap(LEASH_SIZE_OPTIONS),
  [LEASH_FACET_PARAM_KEYS.condition]: optionLabelMap(LEASH_CONDITION_OPTIONS),
}

function optionLabelMap(options: readonly LeashFacetOption[]): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.value, o.label]))
}

/** Display label for a single facet slug, or the raw slug as a fallback. */
export function leashFacetOptionLabel(paramKey: string, value: string): string {
  return LABEL_LOOKUPS[paramKey]?.[value] ?? value
}

/** Parse a comma-separated facet param into a de-duped, allowed slug list. */
export function parseLeashFacetParam(
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

export const LEASH_FACET_ALLOWED_VALUES: Record<LeashFacetParamKey, readonly string[]> = {
  [LEASH_FACET_PARAM_KEYS.size]: LEASH_SIZE_OPTIONS.map((o) => o.value),
  [LEASH_FACET_PARAM_KEYS.condition]: LEASH_CONDITION_OPTIONS.map((o) => o.value),
}

export type LeashesBrowseFacetSelections = {
  sizes: string[]
  conditions: string[]
}

export const EMPTY_LEASH_FACET_SELECTIONS: LeashesBrowseFacetSelections = {
  sizes: [],
  conditions: [],
}

/** Read all facet selections from a search-params bag. */
export function leashFacetSelectionsFromParams(sp: {
  size?: string | string[]
  condition?: string | string[]
}): LeashesBrowseFacetSelections {
  return {
    sizes: parseLeashFacetParam(sp.size, LEASH_FACET_ALLOWED_VALUES.size),
    conditions: parseLeashFacetParam(sp.condition, LEASH_FACET_ALLOWED_VALUES.condition),
  }
}

export function hasAnyLeashFacetSelection(sel: LeashesBrowseFacetSelections): boolean {
  return sel.sizes.length > 0 || sel.conditions.length > 0
}
