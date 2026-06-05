/**
 * Browse filter facets for the /fins marketplace page. Mirrors
 * `lib/boards-browse-facets.ts` but scoped to the attributes that matter for
 * fins: fin setup (layout), fin system (plug/box), size, and condition.
 *
 * All multi-select facets serialize to the URL as comma-separated slug lists.
 */

import {
  FIN_SETUP_OPTIONS,
  FIN_SYSTEM_OPTIONS_FOR_FINS,
  FIN_SIZE_OPTIONS,
  type FinFacetOption,
} from "@/lib/fin-listing-config"
import { listingConditionFilterRows } from "@/lib/listing-labels"

export type { FinFacetOption } from "@/lib/fin-listing-config"

/** Condition — multi-select against `listings.condition`. */
export const FIN_CONDITION_OPTIONS: readonly FinFacetOption[] = listingConditionFilterRows()

/** URL query keys for the multi-select facets. */
export const FIN_FACET_PARAM_KEYS = {
  finSetup: "fin",
  finSystem: "finSystem",
  size: "size",
  condition: "condition",
} as const

export type FinFacetParamKey =
  (typeof FIN_FACET_PARAM_KEYS)[keyof typeof FIN_FACET_PARAM_KEYS]

const LABEL_LOOKUPS: Record<string, Record<string, string>> = {
  [FIN_FACET_PARAM_KEYS.finSetup]: optionLabelMap(FIN_SETUP_OPTIONS),
  [FIN_FACET_PARAM_KEYS.finSystem]: optionLabelMap(FIN_SYSTEM_OPTIONS_FOR_FINS),
  [FIN_FACET_PARAM_KEYS.size]: optionLabelMap(FIN_SIZE_OPTIONS),
  [FIN_FACET_PARAM_KEYS.condition]: optionLabelMap(FIN_CONDITION_OPTIONS),
}

function optionLabelMap(options: readonly FinFacetOption[]): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.value, o.label]))
}

/** Display label for a single facet slug, or the raw slug as a fallback. */
export function finFacetOptionLabel(paramKey: string, value: string): string {
  return LABEL_LOOKUPS[paramKey]?.[value] ?? value
}

/** Parse a comma-separated facet param into a de-duped, allowed slug list. */
export function parseFinFacetParam(
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

export const FIN_FACET_ALLOWED_VALUES: Record<FinFacetParamKey, readonly string[]> = {
  [FIN_FACET_PARAM_KEYS.finSetup]: FIN_SETUP_OPTIONS.map((o) => o.value),
  [FIN_FACET_PARAM_KEYS.finSystem]: FIN_SYSTEM_OPTIONS_FOR_FINS.map((o) => o.value),
  [FIN_FACET_PARAM_KEYS.size]: FIN_SIZE_OPTIONS.map((o) => o.value),
  [FIN_FACET_PARAM_KEYS.condition]: FIN_CONDITION_OPTIONS.map((o) => o.value),
}

export type FinsBrowseFacetSelections = {
  finSetups: string[]
  finSystems: string[]
  sizes: string[]
  conditions: string[]
}

export const EMPTY_FIN_FACET_SELECTIONS: FinsBrowseFacetSelections = {
  finSetups: [],
  finSystems: [],
  sizes: [],
  conditions: [],
}

/** Read all facet selections from a search-params bag. */
export function finFacetSelectionsFromParams(sp: {
  fin?: string | string[]
  finSystem?: string | string[]
  size?: string | string[]
  condition?: string | string[]
}): FinsBrowseFacetSelections {
  return {
    finSetups: parseFinFacetParam(sp.fin, FIN_FACET_ALLOWED_VALUES.fin),
    finSystems: parseFinFacetParam(sp.finSystem, FIN_FACET_ALLOWED_VALUES.finSystem),
    sizes: parseFinFacetParam(sp.size, FIN_FACET_ALLOWED_VALUES.size),
    conditions: parseFinFacetParam(sp.condition, FIN_FACET_ALLOWED_VALUES.condition),
  }
}

export function hasAnyFinFacetSelection(sel: FinsBrowseFacetSelections): boolean {
  return (
    sel.finSetups.length > 0 ||
    sel.finSystems.length > 0 ||
    sel.sizes.length > 0 ||
    sel.conditions.length > 0
  )
}
