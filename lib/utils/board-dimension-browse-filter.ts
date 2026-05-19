import {
  formatDecimalDimension,
  normalizeBoardLengthInput,
  normalizeTapeStyleInchesInput,
  normalizeVolumeLitersInput,
  parseVolumeLiters,
} from "@/lib/board-measurements"
import { parseListingDimensionsColumn } from "@/lib/listing-dimensions-storage"
import type { BoardDimensionsInputValues } from "@/components/board-dimensions-input-fields"

/** URL query keys for /boards dimension filters (match sell-form fields). */
export const BOARD_DIM_BROWSE_PARAM_KEYS = {
  length: "dimLength",
  width: "dimWidth",
  thickness: "dimThickness",
  volume: "dimVolume",
} as const

export type BoardDimensionBrowseFields = BoardDimensionsInputValues

export function hasActiveBoardDimensionBrowseFilters(
  fields: BoardDimensionBrowseFields,
): boolean {
  return (
    Boolean(fields.boardLength.trim()) ||
    Boolean(fields.boardWidthInches.trim()) ||
    Boolean(fields.boardThicknessInches.trim()) ||
    Boolean(fields.boardVolumeL.trim())
  )
}

/** Substrings for `listings.dimensions` ilike filters (AND across tokens). */
export function boardDimensionBrowseIlikeTokens(
  fields: BoardDimensionBrowseFields,
): string[] {
  const tokens: string[] = []

  const len = normalizeBoardLengthInput(fields.boardLength).trim()
  if (len) tokens.push(len)

  const w = normalizeTapeStyleInchesInput(fields.boardWidthInches).trim()
  if (w) tokens.push(w)

  const t = normalizeTapeStyleInchesInput(fields.boardThicknessInches).trim()
  if (t) tokens.push(t)

  const volRaw = normalizeVolumeLitersInput(fields.boardVolumeL).trim()
  if (volRaw) {
    const n = parseVolumeLiters(volRaw)
    if (n != null) {
      const core = Number.isInteger(n) ? String(Math.trunc(n)) : formatDecimalDimension(n)
      tokens.push(`${core}L`)
    } else {
      tokens.push(volRaw.replace(/\s*[lL]\s*$/u, "").trim() || volRaw)
    }
  }

  return tokens
}

export function boardDimensionBrowseFieldsFromSearchParams(input: {
  dimLength?: string | null
  dimWidth?: string | null
  dimThickness?: string | null
  dimVolume?: string | null
  /** Legacy single-field filter (`dimensions=`). */
  legacyDimensions?: string | null
}): BoardDimensionBrowseFields {
  const fromParams: BoardDimensionBrowseFields = {
    boardLength: normalizeBoardLengthInput(input.dimLength ?? ""),
    boardWidthInches: normalizeTapeStyleInchesInput(input.dimWidth ?? ""),
    boardThicknessInches: normalizeTapeStyleInchesInput(input.dimThickness ?? ""),
    boardVolumeL: normalizeVolumeLitersInput(input.dimVolume ?? ""),
  }

  if (hasActiveBoardDimensionBrowseFilters(fromParams)) return fromParams

  const legacy = input.legacyDimensions?.trim()
  if (!legacy) return fromParams

  const parsed = parseListingDimensionsColumn(legacy)
  if (parsed) return parsed

  return {
    ...fromParams,
    boardLength: normalizeBoardLengthInput(legacy),
  }
}

export function appendBoardDimensionBrowseParams(
  params: URLSearchParams,
  fields: BoardDimensionBrowseFields,
): void {
  const len = normalizeBoardLengthInput(fields.boardLength).trim()
  const w = normalizeTapeStyleInchesInput(fields.boardWidthInches).trim()
  const t = normalizeTapeStyleInchesInput(fields.boardThicknessInches).trim()
  const v = normalizeVolumeLitersInput(fields.boardVolumeL).trim()

  if (len) params.set(BOARD_DIM_BROWSE_PARAM_KEYS.length, len)
  if (w) params.set(BOARD_DIM_BROWSE_PARAM_KEYS.width, w)
  if (t) params.set(BOARD_DIM_BROWSE_PARAM_KEYS.thickness, t)
  if (v) params.set(BOARD_DIM_BROWSE_PARAM_KEYS.volume, v)
}

/** Human-readable summary for saved-search UI. */
export function boardDimensionBrowseSummary(fields: BoardDimensionBrowseFields): string | undefined {
  const parts: string[] = []
  const len = normalizeBoardLengthInput(fields.boardLength).trim()
  if (len) parts.push(len)
  const w = normalizeTapeStyleInchesInput(fields.boardWidthInches).trim()
  if (w) parts.push(`${w}"`)
  const t = normalizeTapeStyleInchesInput(fields.boardThicknessInches).trim()
  if (t) parts.push(`${t}" thick`)
  const v = normalizeVolumeLitersInput(fields.boardVolumeL).trim()
  if (v) parts.push(`${v.replace(/\s*[lL]\s*$/u, "").trim() || v}L`)
  return parts.length > 0 ? parts.join(" · ") : undefined
}
