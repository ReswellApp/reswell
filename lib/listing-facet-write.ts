/**
 * Maps surfboard sell-form values to the structured browse-filter columns on `listings`
 * (`length_total_inches`, `volume_liters`, `fin_system`, `construction`, `fins_included`). Keeping this in one
 * place lets the sell flow spread `...boardBrowseFacetFieldsForDb(fd)` into its insert/update rows.
 */

import {
  parseVolumeLiters,
  totalBoardLengthInchesFromCombinedInput,
} from "@/lib/board-measurements"
import {
  resolveLengthTotalInches as resolveLengthTotalInchesFromRow,
  resolveVolumeLiters as resolveVolumeLitersFromRow,
  type ListingBrowseFacetMeasurementRow,
} from "@/lib/listing-browse-facet-measurements"
import {
  FIN_SYSTEM_OPTIONS,
  CONSTRUCTION_OPTIONS,
} from "@/lib/boards-browse-facets"
import { serializeFinsSetupTags } from "@/lib/listing-fin-setup-tags"

const FIN_SYSTEM_SLUGS = new Set(FIN_SYSTEM_OPTIONS.map((o) => o.value))
const CONSTRUCTION_SLUGS = new Set(CONSTRUCTION_OPTIONS.map((o) => o.value))

export type BoardBrowseFacetWriteInput = {
  boardLength?: string
  boardVolumeL?: string
  /** Single fin-setup slug from the sell form (serialized to comma-joined `fins_setup`). */
  boardFins?: string
  boardFinSystem?: string
  boardConstruction?: string
  /** Sell-form value: `included` | `not_included` | empty. */
  boardFinsIncluded?: string
}

export type BoardBrowseFacetDbFields = {
  length_total_inches: number | null
  volume_liters: number | null
  fin_system: string | null
  construction: string | null
  fins_included: boolean | null
}

/** Maps sell-form fins-included choice to `listings.fins_included`. */
export function finsIncludedFieldForDb(raw: string | undefined): boolean | null {
  const v = raw?.trim().toLowerCase() ?? ""
  if (v === "included") return true
  if (v === "not_included") return false
  return null
}

/** Restore sell-form value from `listings.fins_included`. */
export function finsIncludedFormValue(
  value: boolean | null | undefined,
): "included" | "not_included" | "" {
  if (value === true) return "included"
  if (value === false) return "not_included"
  return ""
}

/** Maps sell-form fin setup slug to `listings.fins_setup` (validated comma-joined slugs). */
export function finsSetupFieldForDb(boardFins: string | undefined): string | null {
  const slug = boardFins?.trim() ?? ""
  return serializeFinsSetupTags(slug ? [slug] : [])
}

/** Resolve indexed length for browse filters, falling back to `dimensions` when unset. */
export function resolveLengthTotalInches(row: ListingBrowseFacetMeasurementRow): number | null {
  return resolveLengthTotalInchesFromRow(row)
}

/** Resolve indexed volume for browse filters, falling back to `dimensions` when unset. */
export function resolveVolumeLiters(row: ListingBrowseFacetMeasurementRow): number | null {
  return resolveVolumeLitersFromRow(row)
}

export function boardBrowseFacetFieldsForDb(
  fd: BoardBrowseFacetWriteInput,
): BoardBrowseFacetDbFields {
  const length = fd.boardLength?.trim()
    ? totalBoardLengthInchesFromCombinedInput(fd.boardLength)
    : null
  const volume = fd.boardVolumeL?.trim() ? parseVolumeLiters(fd.boardVolumeL) : null
  const finSystem = fd.boardFinSystem?.trim().toLowerCase() ?? ""
  const construction = fd.boardConstruction?.trim().toLowerCase() ?? ""
  return {
    length_total_inches: length != null && Number.isFinite(length) ? length : null,
    volume_liters: volume != null && Number.isFinite(volume) ? volume : null,
    fin_system: FIN_SYSTEM_SLUGS.has(finSystem) ? finSystem : null,
    construction: CONSTRUCTION_SLUGS.has(construction) ? construction : null,
    fins_included: finsIncludedFieldForDb(fd.boardFinsIncluded),
  }
}
