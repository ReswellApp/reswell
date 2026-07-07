/**
 * Pure, in-memory computation of cross-faceted availability counts for the surfboard browse
 * filter UI. For each facet, counts reflect the rows that match every *other* selected facet
 * (standard faceted-search behavior), so a count tells you how many results you'd get if you
 * also enabled that option.
 */

import { browseTypeParamFromBoardType } from "@/lib/marketplace-slug-metadata"
import { parseFinsSetupFromStorage } from "@/lib/listing-fin-setup-tags"
import {
  BOARD_STYLE_OPTIONS,
  CONDITION_OPTIONS,
  CONSTRUCTION_OPTIONS,
  FACET_PARAM_KEYS,
  FIN_SETUP_OPTIONS,
  FIN_SYSTEM_OPTIONS,
  LENGTH_BUCKETS,
  VOLUME_BUCKETS,
  type BoardsBrowseFacetSelections,
  type RangeBucket,
} from "@/lib/boards-browse-facets"
import {
  fetchSurfboardFacetCountRows,
  type FacetCountContext,
  type FacetCountRow,
} from "@/lib/db/boards-browse-facet-counts"
import { resolveLengthTotalInches, resolveVolumeLiters } from "@/lib/listing-facet-write"
import type { SupabaseClient } from "@supabase/supabase-js"

export type BoardsBrowseFacetCounts = {
  style: Record<string, number>
  condition: Record<string, number>
  fin: Record<string, number>
  finSystem: Record<string, number>
  construction: Record<string, number>
  length: Record<string, number>
  volume: Record<string, number>
}

export const EMPTY_FACET_COUNTS: BoardsBrowseFacetCounts = {
  style: {},
  condition: {},
  fin: {},
  finSystem: {},
  construction: {},
  length: {},
  volume: {},
}

function canonicalStyle(row: FacetCountRow): string | null {
  return browseTypeParamFromBoardType(row.board_type) ?? null
}

function rowFinSlugs(row: FacetCountRow): string[] {
  return parseFinsSetupFromStorage(row.fins_setup)
}

function valueInBucket(value: number | null, bucket: RangeBucket): boolean {
  if (value == null || Number.isNaN(value)) return false
  if (bucket.min != null && value < bucket.min) return false
  if (bucket.max != null && value >= bucket.max) return false
  return true
}

function matchesStyle(row: FacetCountRow, values: string[]): boolean {
  if (values.length === 0) return true
  const s = canonicalStyle(row)
  return s != null && values.includes(s)
}

function matchesCondition(row: FacetCountRow, values: string[]): boolean {
  if (values.length === 0) return true
  return row.condition != null && values.includes(row.condition)
}

function matchesFinSetup(row: FacetCountRow, values: string[]): boolean {
  if (values.length === 0) return true
  const slugs = rowFinSlugs(row)
  return values.some((v) => slugs.includes(v))
}

function matchesFinSystem(row: FacetCountRow, values: string[]): boolean {
  if (values.length === 0) return true
  return row.fin_system != null && values.includes(row.fin_system)
}

function matchesConstruction(row: FacetCountRow, values: string[]): boolean {
  if (values.length === 0) return true
  return row.construction != null && values.includes(row.construction)
}

function matchesLength(row: FacetCountRow, values: string[]): boolean {
  if (values.length === 0) return true
  const lengthIn = resolveLengthTotalInches(row)
  return LENGTH_BUCKETS.some(
    (b) => values.includes(b.value) && valueInBucket(lengthIn, b),
  )
}

function matchesVolume(row: FacetCountRow, values: string[]): boolean {
  if (values.length === 0) return true
  const volumeL = resolveVolumeLiters(row)
  return VOLUME_BUCKETS.some(
    (b) => values.includes(b.value) && valueInBucket(volumeL, b),
  )
}

/**
 * Rows passing every selected facet except `exclude`. Counting an option within `exclude`
 * against this base set yields the cross-faceted count for that option.
 */
function baseRows(
  rows: FacetCountRow[],
  sel: BoardsBrowseFacetSelections,
  exclude: keyof BoardsBrowseFacetCounts,
): FacetCountRow[] {
  return rows.filter((row) => {
    if (exclude !== "style" && !matchesStyle(row, sel.styles)) return false
    if (exclude !== "condition" && !matchesCondition(row, sel.conditions)) return false
    if (exclude !== "fin" && !matchesFinSetup(row, sel.finSetups)) return false
    if (exclude !== "finSystem" && !matchesFinSystem(row, sel.finSystems)) return false
    if (exclude !== "construction" && !matchesConstruction(row, sel.constructions)) return false
    if (exclude !== "length" && !matchesLength(row, sel.lengthBuckets)) return false
    if (exclude !== "volume" && !matchesVolume(row, sel.volumeBuckets)) return false
    return true
  })
}

export function computeBoardsBrowseFacetCounts(
  rows: FacetCountRow[],
  sel: BoardsBrowseFacetSelections,
): BoardsBrowseFacetCounts {
  const counts: BoardsBrowseFacetCounts = {
    style: {},
    condition: {},
    fin: {},
    finSystem: {},
    construction: {},
    length: {},
    volume: {},
  }

  const styleBase = baseRows(rows, sel, "style")
  for (const o of BOARD_STYLE_OPTIONS) {
    counts.style[o.value] = styleBase.filter((r) => canonicalStyle(r) === o.value).length
  }

  const conditionBase = baseRows(rows, sel, "condition")
  for (const o of CONDITION_OPTIONS) {
    counts.condition[o.value] = conditionBase.filter((r) => r.condition === o.value).length
  }

  const finBase = baseRows(rows, sel, "fin")
  for (const o of FIN_SETUP_OPTIONS) {
    counts.fin[o.value] = finBase.filter((r) => rowFinSlugs(r).includes(o.value)).length
  }

  const finSystemBase = baseRows(rows, sel, "finSystem")
  for (const o of FIN_SYSTEM_OPTIONS) {
    counts.finSystem[o.value] = finSystemBase.filter((r) => r.fin_system === o.value).length
  }

  const constructionBase = baseRows(rows, sel, "construction")
  for (const o of CONSTRUCTION_OPTIONS) {
    counts.construction[o.value] = constructionBase.filter(
      (r) => r.construction === o.value,
    ).length
  }

  const lengthBase = baseRows(rows, sel, "length")
  for (const b of LENGTH_BUCKETS) {
    counts.length[b.value] = lengthBase.filter((r) =>
      valueInBucket(resolveLengthTotalInches(r), b),
    ).length
  }

  const volumeBase = baseRows(rows, sel, "volume")
  for (const b of VOLUME_BUCKETS) {
    counts.volume[b.value] = volumeBase.filter((r) =>
      valueInBucket(resolveVolumeLiters(r), b),
    ).length
  }

  return counts
}

/** Fetch the lean candidate rows and compute cross-faceted counts for the current context. */
export async function getBoardsBrowseFacetCounts(
  supabase: SupabaseClient,
  ctx: FacetCountContext,
  sel: BoardsBrowseFacetSelections,
): Promise<BoardsBrowseFacetCounts> {
  try {
    const rows = await fetchSurfboardFacetCountRows(supabase, ctx)
    return computeBoardsBrowseFacetCounts(rows, sel)
  } catch (error) {
    console.error("getBoardsBrowseFacetCounts:", error)
    return EMPTY_FACET_COUNTS
  }
}

/** Convenience for the param-keyed counts map used by the UI. */
export function facetCountsByParamKey(
  counts: BoardsBrowseFacetCounts,
): Record<string, Record<string, number>> {
  return {
    [FACET_PARAM_KEYS.style]: counts.style,
    [FACET_PARAM_KEYS.condition]: counts.condition,
    [FACET_PARAM_KEYS.finSetup]: counts.fin,
    [FACET_PARAM_KEYS.finSystem]: counts.finSystem,
    [FACET_PARAM_KEYS.construction]: counts.construction,
    [FACET_PARAM_KEYS.length]: counts.length,
    [FACET_PARAM_KEYS.volume]: counts.volume,
  }
}
