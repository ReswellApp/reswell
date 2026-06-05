/**
 * Browse filter facets for the /wetsuits marketplace page. Mirrors
 * `lib/fins-browse-facets.ts` scoped to the attributes that matter for wetsuits:
 * size and condition.
 *
 * All multi-select facets serialize to the URL as comma-separated slug lists.
 */

import {
  WETSUIT_SIZE_OPTIONS,
  type WetsuitFacetOption,
} from "@/lib/wetsuit-listing-config"
import { listingConditionFilterRows } from "@/lib/listing-labels"

export type { WetsuitFacetOption } from "@/lib/wetsuit-listing-config"

/** Condition — multi-select against `listings.condition`. */
export const WETSUIT_CONDITION_OPTIONS: readonly WetsuitFacetOption[] = listingConditionFilterRows()

/** URL query keys for the multi-select facets. */
export const WETSUIT_FACET_PARAM_KEYS = {
  size: "size",
  condition: "condition",
} as const

export type WetsuitFacetParamKey =
  (typeof WETSUIT_FACET_PARAM_KEYS)[keyof typeof WETSUIT_FACET_PARAM_KEYS]

const LABEL_LOOKUPS: Record<string, Record<string, string>> = {
  [WETSUIT_FACET_PARAM_KEYS.size]: optionLabelMap(WETSUIT_SIZE_OPTIONS),
  [WETSUIT_FACET_PARAM_KEYS.condition]: optionLabelMap(WETSUIT_CONDITION_OPTIONS),
}

function optionLabelMap(options: readonly WetsuitFacetOption[]): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.value, o.label]))
}

/** Display label for a single facet slug, or the raw slug as a fallback. */
export function wetsuitFacetOptionLabel(paramKey: string, value: string): string {
  return LABEL_LOOKUPS[paramKey]?.[value] ?? value
}

/** Parse a comma-separated facet param into a de-duped, allowed slug list. */
export function parseWetsuitFacetParam(
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

export const WETSUIT_FACET_ALLOWED_VALUES: Record<WetsuitFacetParamKey, readonly string[]> = {
  [WETSUIT_FACET_PARAM_KEYS.size]: WETSUIT_SIZE_OPTIONS.map((o) => o.value),
  [WETSUIT_FACET_PARAM_KEYS.condition]: WETSUIT_CONDITION_OPTIONS.map((o) => o.value),
}

export type WetsuitsBrowseFacetSelections = {
  sizes: string[]
  conditions: string[]
}

export const EMPTY_WETSUIT_FACET_SELECTIONS: WetsuitsBrowseFacetSelections = {
  sizes: [],
  conditions: [],
}

/** Read all facet selections from a search-params bag. */
export function wetsuitFacetSelectionsFromParams(sp: {
  size?: string | string[]
  condition?: string | string[]
}): WetsuitsBrowseFacetSelections {
  return {
    sizes: parseWetsuitFacetParam(sp.size, WETSUIT_FACET_ALLOWED_VALUES.size),
    conditions: parseWetsuitFacetParam(sp.condition, WETSUIT_FACET_ALLOWED_VALUES.condition),
  }
}

export function hasAnyWetsuitFacetSelection(sel: WetsuitsBrowseFacetSelections): boolean {
  return sel.sizes.length > 0 || sel.conditions.length > 0
}
