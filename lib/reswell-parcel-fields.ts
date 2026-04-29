import {
  parseBoardMeasurement,
  totalBoardLengthInchesFromCombinedInput,
} from "@/lib/board-measurements"
import { RESWELL_PACK_PADDING_TOTAL_PER_AXIS_IN } from "@/lib/surfboard-shipping-estimates"

/**
 * Parcel length field on `/sell`:
 * - Contains `'` (feet'inches,same as board length) → treated as bare board/rail bag length → we add standard packing cushion for carriers.
 * - Plain number → treated as outer packed length in inches (already accounts for boxing) → stored as-is.
 */
export function parseReswellParcelLengthRawToCarrierInches(raw: string | undefined): number | null {
  const t = raw?.trim() ?? ""
  if (!t) return null
  const normalizedPrime = t.replace(/[\u2032\u2019＇]/g, "'")
  if (normalizedPrime.includes("'")) {
    const board = totalBoardLengthInchesFromCombinedInput(t)
    if (board == null || board <= 0) return null
    return board + RESWELL_PACK_PADDING_TOTAL_PER_AXIS_IN
  }
  const n = parseFloat(t.replace(/,/g, ""))
  if (!Number.isFinite(n) || n <= 0) return null
  return n
}

/**
 * Packed width / height: values match how board width & thickness are entered on `/sell`;
 * we add the same cushion as length for carriers.
 */
export function parseReswellParcelWidthHeightRawToCarrierInches(
  raw: string | undefined,
): number | null {
  const t = raw?.trim() ?? ""
  if (!t) return null
  const v =
    parseBoardMeasurement(t) ??
    Number.parseFloat(t.replace(/\s+/g, "").replace(/,/g, ""))
  if (!Number.isFinite(v) || v <= 0) return null
  return v + RESWELL_PACK_PADDING_TOTAL_PER_AXIS_IN
}
