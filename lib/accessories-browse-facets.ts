/**
 * Browse filter facets for the /accessories marketplace page. Mirrors
 * `lib/fins-browse-facets.ts` scoped to the attributes that matter for accessories:
 * size and condition.
 *
 * All multi-select facets serialize to the URL as comma-separated slug lists.
 */

import {
  ACCESSORY_SIZE_OPTIONS,
  type AccessoryFacetOption,
} from "@/lib/accessory-listing-config"
import { listingConditionFilterRows } from "@/lib/listing-labels"

export type { AccessoryFacetOption } from "@/lib/accessory-listing-config"

/** Condition — multi-select against `listings.condition`. */
export const ACCESSORY_CONDITION_OPTIONS: readonly AccessoryFacetOption[] = listingConditionFilterRows()

/** URL query keys for the multi-select facets. */
export const ACCESSORY_FACET_PARAM_KEYS = {
  size: "size",
  condition: "condition",
} as const

export type AccessoryFacetParamKey =
  (typeof ACCESSORY_FACET_PARAM_KEYS)[keyof typeof ACCESSORY_FACET_PARAM_KEYS]

const LABEL_LOOKUPS: Record<string, Record<string, string>> = {
  [ACCESSORY_FACET_PARAM_KEYS.size]: optionLabelMap(ACCESSORY_SIZE_OPTIONS),
  [ACCESSORY_FACET_PARAM_KEYS.condition]: optionLabelMap(ACCESSORY_CONDITION_OPTIONS),
}

function optionLabelMap(options: readonly AccessoryFacetOption[]): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.value, o.label]))
}

/** Display label for a single facet slug, or the raw slug as a fallback. */
export function accessoryFacetOptionLabel(paramKey: string, value: string): string {
  return LABEL_LOOKUPS[paramKey]?.[value] ?? value
}

/** Parse a comma-separated facet param into a de-duped, allowed slug list. */
export function parseAccessoryFacetParam(
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

export const ACCESSORY_FACET_ALLOWED_VALUES: Record<AccessoryFacetParamKey, readonly string[]> = {
  [ACCESSORY_FACET_PARAM_KEYS.size]: ACCESSORY_SIZE_OPTIONS.map((o) => o.value),
  [ACCESSORY_FACET_PARAM_KEYS.condition]: ACCESSORY_CONDITION_OPTIONS.map((o) => o.value),
}

export type AccessoriesBrowseFacetSelections = {
  sizes: string[]
  conditions: string[]
}

export const EMPTY_ACCESSORY_FACET_SELECTIONS: AccessoriesBrowseFacetSelections = {
  sizes: [],
  conditions: [],
}

/** Read all facet selections from a search-params bag. */
export function accessoryFacetSelectionsFromParams(sp: {
  size?: string | string[]
  condition?: string | string[]
}): AccessoriesBrowseFacetSelections {
  return {
    sizes: parseAccessoryFacetParam(sp.size, ACCESSORY_FACET_ALLOWED_VALUES.size),
    conditions: parseAccessoryFacetParam(sp.condition, ACCESSORY_FACET_ALLOWED_VALUES.condition),
  }
}

export function hasAnyAccessoryFacetSelection(sel: AccessoriesBrowseFacetSelections): boolean {
  return sel.sizes.length > 0 || sel.conditions.length > 0
}
