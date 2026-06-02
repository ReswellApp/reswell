/**
 * Maps surfboard sell-form values to the structured browse-filter columns on `listings`
 * (`length_total_inches`, `volume_liters`, `fin_system`, `construction`). Keeping this in one
 * place lets the sell flow spread `...boardBrowseFacetFieldsForDb(fd)` into its insert/update rows.
 */

import {
  parseVolumeLiters,
  totalBoardLengthInchesFromCombinedInput,
} from "@/lib/board-measurements"
import {
  FIN_SYSTEM_OPTIONS,
  CONSTRUCTION_OPTIONS,
} from "@/lib/boards-browse-facets"

const FIN_SYSTEM_SLUGS = new Set(FIN_SYSTEM_OPTIONS.map((o) => o.value))
const CONSTRUCTION_SLUGS = new Set(CONSTRUCTION_OPTIONS.map((o) => o.value))

export type BoardBrowseFacetWriteInput = {
  boardLength?: string
  boardVolumeL?: string
  boardFinSystem?: string
  boardConstruction?: string
}

export type BoardBrowseFacetDbFields = {
  length_total_inches: number | null
  volume_liters: number | null
  fin_system: string | null
  construction: string | null
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
  }
}
