/**
 * Browse filter facets for the /apparel marketplace page. Mirrors
 * `lib/fins-browse-facets.ts` scoped to the attributes that matter for apparel:
 * size and condition.
 *
 * All multi-select facets serialize to the URL as comma-separated slug lists.
 */

import {
  APPAREL_SIZE_OPTIONS,
  type ApparelFacetOption,
} from "@/lib/apparel-listing-config"
import { listingConditionFilterRows } from "@/lib/listing-labels"

export type { ApparelFacetOption } from "@/lib/apparel-listing-config"

/** Condition — multi-select against `listings.condition`. */
export const APPAREL_CONDITION_OPTIONS: readonly ApparelFacetOption[] = listingConditionFilterRows()

/** URL query keys for the multi-select facets. */
export const APPAREL_FACET_PARAM_KEYS = {
  size: "size",
  condition: "condition",
} as const

export type ApparelFacetParamKey =
  (typeof APPAREL_FACET_PARAM_KEYS)[keyof typeof APPAREL_FACET_PARAM_KEYS]

const LABEL_LOOKUPS: Record<string, Record<string, string>> = {
  [APPAREL_FACET_PARAM_KEYS.size]: optionLabelMap(APPAREL_SIZE_OPTIONS),
  [APPAREL_FACET_PARAM_KEYS.condition]: optionLabelMap(APPAREL_CONDITION_OPTIONS),
}

function optionLabelMap(options: readonly ApparelFacetOption[]): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.value, o.label]))
}

/** Display label for a single facet slug, or the raw slug as a fallback. */
export function apparelFacetOptionLabel(paramKey: string, value: string): string {
  return LABEL_LOOKUPS[paramKey]?.[value] ?? value
}

/** Parse a comma-separated facet param into a de-duped, allowed slug list. */
export function parseApparelFacetParam(
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

export const APPAREL_FACET_ALLOWED_VALUES: Record<ApparelFacetParamKey, readonly string[]> = {
  [APPAREL_FACET_PARAM_KEYS.size]: APPAREL_SIZE_OPTIONS.map((o) => o.value),
  [APPAREL_FACET_PARAM_KEYS.condition]: APPAREL_CONDITION_OPTIONS.map((o) => o.value),
}

export type ApparelBrowseFacetSelections = {
  sizes: string[]
  conditions: string[]
}

export const EMPTY_APPAREL_FACET_SELECTIONS: ApparelBrowseFacetSelections = {
  sizes: [],
  conditions: [],
}

/** Read all facet selections from a search-params bag. */
export function apparelFacetSelectionsFromParams(sp: {
  size?: string | string[]
  condition?: string | string[]
}): ApparelBrowseFacetSelections {
  return {
    sizes: parseApparelFacetParam(sp.size, APPAREL_FACET_ALLOWED_VALUES.size),
    conditions: parseApparelFacetParam(sp.condition, APPAREL_FACET_ALLOWED_VALUES.condition),
  }
}

export function hasAnyApparelFacetSelection(sel: ApparelBrowseFacetSelections): boolean {
  return sel.sizes.length > 0 || sel.conditions.length > 0
}
