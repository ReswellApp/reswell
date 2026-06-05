/**
 * Browse filter facets for the /surfpacks marketplace page. Mirrors
 * `lib/fins-browse-facets.ts` scoped to the attributes that matter for surfpacks:
 * size and condition.
 *
 * All multi-select facets serialize to the URL as comma-separated slug lists.
 */

import {
  SURFPACK_SIZE_OPTIONS,
  type SurfpackFacetOption,
} from "@/lib/surfpack-listing-config"
import { listingConditionFilterRows } from "@/lib/listing-labels"

export type { SurfpackFacetOption } from "@/lib/surfpack-listing-config"

/** Condition — multi-select against `listings.condition`. */
export const SURFPACK_CONDITION_OPTIONS: readonly SurfpackFacetOption[] = listingConditionFilterRows()

/** URL query keys for the multi-select facets. */
export const SURFPACK_FACET_PARAM_KEYS = {
  size: "size",
  condition: "condition",
} as const

export type SurfpackFacetParamKey =
  (typeof SURFPACK_FACET_PARAM_KEYS)[keyof typeof SURFPACK_FACET_PARAM_KEYS]

const LABEL_LOOKUPS: Record<string, Record<string, string>> = {
  [SURFPACK_FACET_PARAM_KEYS.size]: optionLabelMap(SURFPACK_SIZE_OPTIONS),
  [SURFPACK_FACET_PARAM_KEYS.condition]: optionLabelMap(SURFPACK_CONDITION_OPTIONS),
}

function optionLabelMap(options: readonly SurfpackFacetOption[]): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.value, o.label]))
}

/** Display label for a single facet slug, or the raw slug as a fallback. */
export function surfpackFacetOptionLabel(paramKey: string, value: string): string {
  return LABEL_LOOKUPS[paramKey]?.[value] ?? value
}

/** Parse a comma-separated facet param into a de-duped, allowed slug list. */
export function parseSurfpackFacetParam(
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

export const SURFPACK_FACET_ALLOWED_VALUES: Record<SurfpackFacetParamKey, readonly string[]> = {
  [SURFPACK_FACET_PARAM_KEYS.size]: SURFPACK_SIZE_OPTIONS.map((o) => o.value),
  [SURFPACK_FACET_PARAM_KEYS.condition]: SURFPACK_CONDITION_OPTIONS.map((o) => o.value),
}

export type SurfpacksBrowseFacetSelections = {
  sizes: string[]
  conditions: string[]
}

export const EMPTY_SURFPACK_FACET_SELECTIONS: SurfpacksBrowseFacetSelections = {
  sizes: [],
  conditions: [],
}

/** Read all facet selections from a search-params bag. */
export function surfpackFacetSelectionsFromParams(sp: {
  size?: string | string[]
  condition?: string | string[]
}): SurfpacksBrowseFacetSelections {
  return {
    sizes: parseSurfpackFacetParam(sp.size, SURFPACK_FACET_ALLOWED_VALUES.size),
    conditions: parseSurfpackFacetParam(sp.condition, SURFPACK_FACET_ALLOWED_VALUES.condition),
  }
}

export function hasAnySurfpackFacetSelection(sel: SurfpacksBrowseFacetSelections): boolean {
  return sel.sizes.length > 0 || sel.conditions.length > 0
}
