import { listingConditionFilterRows } from "@/lib/listing-labels"

export type MagazineFacetOption = { value: string; label: string }

export const MAGAZINE_CONDITION_OPTIONS: readonly MagazineFacetOption[] =
  listingConditionFilterRows()

export const MAGAZINE_FACET_PARAM_KEYS = {
  condition: "condition",
} as const

export type MagazineFacetParamKey =
  (typeof MAGAZINE_FACET_PARAM_KEYS)[keyof typeof MAGAZINE_FACET_PARAM_KEYS]

const LABEL_LOOKUPS: Record<string, Record<string, string>> = {
  [MAGAZINE_FACET_PARAM_KEYS.condition]: optionLabelMap(MAGAZINE_CONDITION_OPTIONS),
}

function optionLabelMap(options: readonly MagazineFacetOption[]): Record<string, string> {
  return Object.fromEntries(options.map((o) => [o.value, o.label]))
}

export function magazineFacetOptionLabel(paramKey: string, value: string): string {
  return LABEL_LOOKUPS[paramKey]?.[value] ?? value
}

export function parseMagazineFacetParam(
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

export const MAGAZINE_FACET_ALLOWED_VALUES: Record<MagazineFacetParamKey, readonly string[]> = {
  [MAGAZINE_FACET_PARAM_KEYS.condition]: MAGAZINE_CONDITION_OPTIONS.map((o) => o.value),
}

export type MagazinesBrowseFacetSelections = {
  conditions: string[]
}

export const EMPTY_MAGAZINE_FACET_SELECTIONS: MagazinesBrowseFacetSelections = {
  conditions: [],
}

export function magazineFacetSelectionsFromParams(sp: {
  condition?: string | string[]
}): MagazinesBrowseFacetSelections {
  return {
    conditions: parseMagazineFacetParam(
      sp.condition,
      MAGAZINE_FACET_ALLOWED_VALUES.condition,
    ),
  }
}

export function hasAnyMagazineFacetSelection(sel: MagazinesBrowseFacetSelections): boolean {
  return sel.conditions.length > 0
}
