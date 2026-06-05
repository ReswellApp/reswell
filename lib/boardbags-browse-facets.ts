/**
 * Browse filter facets for the /boardbags marketplace page. Mirrors
 * `lib/fins-browse-facets.ts` scoped to the attributes that matter for boardbags:
 * size and condition.
 *
 * All multi-select facets serialize to the URL as comma-separated slug lists.
 */

import {
  BOARDBAG_SIZE_OPTIONS,
  type BoardbagFacetOption,
} from "@/lib/boardbag-listing-config"
import { listingConditionFilterRows } from "@/lib/listing-labels"

export type { BoardbagFacetOption } from "@/lib/boardbag-listing-config"

/** Condition — multi-select against `listings.condition`. */
export const BOARDBAG_CONDITION_OPTIONS: readonly BoardbagFacetOption[] = listingConditionFilterRows()

/** URL query keys for the multi-select facets. */
export const BOARDBAG_FACET_PARAM_KEYS = {
  size: "size",
  condition: "condition",
} as const

export type BoardbagFacetParamKey =
  (typeof BOARDBAG_FACET_PARAM_KEYS)[keyof typeof BOARDBAG_FACET_PARAM_KEYS]

const LABEL_LOOKUPS: Record<string, Record<string, string>> = {
  [BOARDBAG_FACET_PARAM_KEYS.size]: optionLabelMap(BOARDBAG_SIZE_OPTIONS),
  [BOARDBAG_FACET_PARAM_KEYS.condition]: optionLabelMap(BOARDBAG_CONDITION_OPTIONS),
}

function optionLabelMap(options: readonly BoardbagFacetOption[]): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.value, o.label]))
}

/** Display label for a single facet slug, or the raw slug as a fallback. */
export function boardbagFacetOptionLabel(paramKey: string, value: string): string {
  return LABEL_LOOKUPS[paramKey]?.[value] ?? value
}

/** Parse a comma-separated facet param into a de-duped, allowed slug list. */
export function parseBoardbagFacetParam(
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

export const BOARDBAG_FACET_ALLOWED_VALUES: Record<BoardbagFacetParamKey, readonly string[]> = {
  [BOARDBAG_FACET_PARAM_KEYS.size]: BOARDBAG_SIZE_OPTIONS.map((o) => o.value),
  [BOARDBAG_FACET_PARAM_KEYS.condition]: BOARDBAG_CONDITION_OPTIONS.map((o) => o.value),
}

export type BoardbagsBrowseFacetSelections = {
  sizes: string[]
  conditions: string[]
}

export const EMPTY_BOARDBAG_FACET_SELECTIONS: BoardbagsBrowseFacetSelections = {
  sizes: [],
  conditions: [],
}

/** Read all facet selections from a search-params bag. */
export function boardbagFacetSelectionsFromParams(sp: {
  size?: string | string[]
  condition?: string | string[]
}): BoardbagsBrowseFacetSelections {
  return {
    sizes: parseBoardbagFacetParam(sp.size, BOARDBAG_FACET_ALLOWED_VALUES.size),
    conditions: parseBoardbagFacetParam(sp.condition, BOARDBAG_FACET_ALLOWED_VALUES.condition),
  }
}

export function hasAnyBoardbagFacetSelection(sel: BoardbagsBrowseFacetSelections): boolean {
  return sel.sizes.length > 0 || sel.conditions.length > 0
}
