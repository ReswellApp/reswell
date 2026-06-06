/**
 * Pure, in-memory computation of cross-faceted availability counts for the /fins browse
 * filter UI. For each facet, counts reflect the rows that match every *other* selected facet
 * (standard faceted-search behavior).
 */

import {
  effectiveFinSetupSlugs,
  effectiveFinSystemSlug,
  finSetupMatchesSelection,
  finSystemMatchesSelection,
} from "@/lib/fin-listing-effective-facets"
import type { FinSetupTagSlug } from "@/lib/listing-fin-setup-tags"
import {
  FIN_CONDITION_OPTIONS,
  FIN_FACET_PARAM_KEYS,
  type FinsBrowseFacetSelections,
} from "@/lib/fins-browse-facets"
import {
  FIN_SETUP_OPTIONS,
  FIN_SYSTEM_OPTIONS_FOR_FINS,
  FIN_SIZE_OPTIONS,
} from "@/lib/fin-listing-config"
import {
  fetchFinFacetCountRows,
  type FinFacetCountContext,
  type FinFacetCountRow,
} from "@/lib/db/fins-browse-facet-counts"
import type { SupabaseClient } from "@supabase/supabase-js"

export type FinsBrowseFacetCounts = {
  finSetup: Record<string, number>
  finSystem: Record<string, number>
  size: Record<string, number>
  condition: Record<string, number>
}

export const EMPTY_FINS_FACET_COUNTS: FinsBrowseFacetCounts = {
  finSetup: {},
  finSystem: {},
  size: {},
  condition: {},
}

function matchesFinSetup(row: FinFacetCountRow, values: string[]): boolean {
  return finSetupMatchesSelection(row, values)
}

function matchesFinSystem(row: FinFacetCountRow, values: string[]): boolean {
  return finSystemMatchesSelection(row, values)
}

function matchesSize(row: FinFacetCountRow, values: string[]): boolean {
  if (values.length === 0) return true
  return row.fin_size != null && values.includes(row.fin_size)
}

function matchesCondition(row: FinFacetCountRow, values: string[]): boolean {
  if (values.length === 0) return true
  return row.condition != null && values.includes(row.condition)
}

function baseRows(
  rows: FinFacetCountRow[],
  sel: FinsBrowseFacetSelections,
  exclude: keyof FinsBrowseFacetCounts,
): FinFacetCountRow[] {
  return rows.filter((row) => {
    if (exclude !== "finSetup" && !matchesFinSetup(row, sel.finSetups)) return false
    if (exclude !== "finSystem" && !matchesFinSystem(row, sel.finSystems)) return false
    if (exclude !== "size" && !matchesSize(row, sel.sizes)) return false
    if (exclude !== "condition" && !matchesCondition(row, sel.conditions)) return false
    return true
  })
}

export function computeFinsBrowseFacetCounts(
  rows: FinFacetCountRow[],
  sel: FinsBrowseFacetSelections,
): FinsBrowseFacetCounts {
  const counts: FinsBrowseFacetCounts = {
    finSetup: {},
    finSystem: {},
    size: {},
    condition: {},
  }

  const finSetupBase = baseRows(rows, sel, "finSetup")
  for (const o of FIN_SETUP_OPTIONS) {
    counts.finSetup[o.value] = finSetupBase.filter((r) =>
      effectiveFinSetupSlugs(r).includes(o.value as FinSetupTagSlug),
    ).length
  }

  const finSystemBase = baseRows(rows, sel, "finSystem")
  for (const o of FIN_SYSTEM_OPTIONS_FOR_FINS) {
    counts.finSystem[o.value] = finSystemBase.filter(
      (r) => effectiveFinSystemSlug(r) === o.value,
    ).length
  }

  const sizeBase = baseRows(rows, sel, "size")
  for (const o of FIN_SIZE_OPTIONS) {
    counts.size[o.value] = sizeBase.filter((r) => r.fin_size === o.value).length
  }

  const conditionBase = baseRows(rows, sel, "condition")
  for (const o of FIN_CONDITION_OPTIONS) {
    counts.condition[o.value] = conditionBase.filter((r) => r.condition === o.value).length
  }

  return counts
}

export async function getFinsBrowseFacetCounts(
  supabase: SupabaseClient,
  ctx: FinFacetCountContext,
  sel: FinsBrowseFacetSelections,
): Promise<FinsBrowseFacetCounts> {
  try {
    const rows = await fetchFinFacetCountRows(supabase, ctx)
    return computeFinsBrowseFacetCounts(rows, sel)
  } catch (error) {
    console.error("getFinsBrowseFacetCounts:", error)
    return EMPTY_FINS_FACET_COUNTS
  }
}

export function finsFacetCountsByParamKey(
  counts: FinsBrowseFacetCounts,
): Record<string, Record<string, number>> {
  return {
    [FIN_FACET_PARAM_KEYS.finSetup]: counts.finSetup,
    [FIN_FACET_PARAM_KEYS.finSystem]: counts.finSystem,
    [FIN_FACET_PARAM_KEYS.size]: counts.size,
    [FIN_FACET_PARAM_KEYS.condition]: counts.condition,
  }
}
