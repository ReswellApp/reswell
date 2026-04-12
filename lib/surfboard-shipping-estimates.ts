/**
 * Heuristics for Reswell-calculated shipping on the sell flow.
 * Estimates are starting points — sellers should verify with a tape measure and scale.
 */

import {
  formatDecimalDimension,
  parseBoardLengthParts,
  parseBoardMeasurement,
  parseLengthFeet,
  parseVolumeLiters,
} from "@/lib/board-measurements"

/**
 * Default padding around the board on **each side** of an axis (nose/tail, rail/rail, deck/bottom).
 * Carriers need outer box **L × W × H in inches**; we add 4″ + 4″ = **8″ per axis** to raw
 * length, width, and thickness from the sell form.
 */
export const RESWELL_PACK_PADDING_PER_SIDE_IN = 4

/** Total inches added per axis (two opposite sides). */
export const RESWELL_PACK_PADDING_TOTAL_PER_AXIS_IN = RESWELL_PACK_PADDING_PER_SIDE_IN * 2

/** Added to estimated bare-board weight for bag, bubble, tape, etc. */
export const RESWELL_PACKAGING_WEIGHT_LB = 4

const KG_PER_LITER_ROUGH = 0.45
const MIN_SHIP_LB = 5
const MAX_SHIP_LB = 45

function totalLengthInchesFromBoardLength(boardLength: string): number | null {
  const { feetStr, inchesStr } = parseBoardLengthParts(boardLength)
  const ft = parseLengthFeet(feetStr)
  if (ft == null) return null
  const inRaw = inchesStr.trim() === "" ? "0" : inchesStr.trim()
  const inchesNum = parseBoardMeasurement(inRaw) ?? Number.parseFloat(inRaw)
  if (!Number.isFinite(inchesNum) || inchesNum < 0 || inchesNum >= 12) {
    return null
  }
  const totalLengthIn = ft * 12 + inchesNum
  if (!Number.isFinite(totalLengthIn) || totalLengthIn <= 0) return null
  return totalLengthIn
}

/**
 * Rough dry-board weight from overall length when liters aren’t available.
 * Wide range in reality — midpoint by foot for UX only.
 */
export function estimatedBareBoardWeightLbFromLengthFt(totalLengthFt: number): number {
  if (!Number.isFinite(totalLengthFt) || totalLengthFt <= 0) return 8
  if (totalLengthFt < 5.5) return 5.5
  if (totalLengthFt < 6.0) return 6.5
  if (totalLengthFt < 6.5) return 7.5
  if (totalLengthFt < 7.0) return 8.5
  if (totalLengthFt < 7.5) return 10
  if (totalLengthFt < 8.0) return 11.5
  if (totalLengthFt < 8.5) return 13.5
  if (totalLengthFt < 9.5) return 16
  return 18
}

/**
 * Packed L×W×H (inches) for carrier rate APIs: board length / width / thickness each get
 * {@link RESWELL_PACK_PADDING_TOTAL_PER_AXIS_IN} (4″ per side).
 */
export function reswellSuggestedPackageInchesFromBoard(input: {
  boardLength: string
  boardWidthInches: string
  boardThicknessInches: string
}): { lengthIn: string; widthIn: string; heightIn: string } | null {
  const totalLengthIn = totalLengthInchesFromBoardLength(input.boardLength)
  if (totalLengthIn == null) return null

  const wRaw = input.boardWidthInches.trim()
  const tRaw = input.boardThicknessInches.trim()
  const wParsed =
    wRaw === ""
      ? null
      : (parseBoardMeasurement(wRaw) ?? Number.parseFloat(wRaw))
  const tParsed =
    tRaw === ""
      ? null
      : (parseBoardMeasurement(tRaw) ?? Number.parseFloat(tRaw))

  const pad = RESWELL_PACK_PADDING_TOTAL_PER_AXIS_IN
  const lenPacked = totalLengthIn + pad
  const wPacked =
    wParsed != null && Number.isFinite(wParsed) && wParsed > 0 ? wParsed + pad : null
  const hPacked =
    tParsed != null && Number.isFinite(tParsed) && tParsed > 0 ? tParsed + pad : null

  return {
    lengthIn: formatDecimalDimension(lenPacked),
    widthIn: wPacked != null ? formatDecimalDimension(wPacked) : "",
    heightIn: hPacked != null ? formatDecimalDimension(hPacked) : "",
  }
}

/**
 * Suggested packed shipping weight (whole pounds + ounces) from length and optional liters.
 */
export function reswellSuggestedShipWeightLbOzFromBoard(input: {
  boardLength: string
  boardVolumeL: string
}): { lb: string; oz: string } | null {
  const totalLengthIn = totalLengthInchesFromBoardLength(input.boardLength)
  if (totalLengthIn == null) return null

  const totalFt = totalLengthIn / 12
  const volRaw = input.boardVolumeL?.trim() ?? ""

  let boardLb: number
  if (volRaw) {
    const vol = parseVolumeLiters(volRaw)
    if (vol != null && vol > 0 && vol < 220) {
      const kg = vol * KG_PER_LITER_ROUGH
      boardLb = kg * 2.20462
    } else {
      boardLb = estimatedBareBoardWeightLbFromLengthFt(totalFt)
    }
  } else {
    boardLb = estimatedBareBoardWeightLbFromLengthFt(totalFt)
  }

  const packagedLb = boardLb + RESWELL_PACKAGING_WEIGHT_LB
  const clamped = Math.min(MAX_SHIP_LB, Math.max(MIN_SHIP_LB, packagedLb))
  const totalOz = Math.round(clamped * 16)
  const lb = Math.floor(totalOz / 16)
  const oz = totalOz % 16
  return { lb: String(lb), oz: String(oz) }
}
