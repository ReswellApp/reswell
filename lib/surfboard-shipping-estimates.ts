/**
 * Heuristics for Reswell-calculated shipping on the sell flow.
 * Estimates are starting points — sellers should verify with a tape measure and scale.
 */

import {
  formatDecimalDimension,
  parseBoardMeasurement,
  parseVolumeLiters,
  totalBoardLengthInchesFromCombinedInput,
} from "@/lib/board-measurements"

/** Added to estimated bare-board weight for bag, bubble, tape, etc. */
export const RESWELL_PACKAGING_WEIGHT_LB = 4

/** Legacy parcel height when board thickness is unknown (6″ overstated dim weight and spiked carrier quotes). */
export const RESWELL_HEURISTIC_FALLBACK_PACKED_HEIGHT_IN = 3.25

/**
 * Standard packing buffer (inches) added to length, width, AND height when handing
 * a listing's board dimensions to ShipEngine. Applied identically in /checkout,
 * /api/stripe/create-payment-intent, and the /admin/shipping listing-rate diagnostic
 * so quotes never disagree across surfaces.
 *
 * The buffer accounts for end-cap foam, bubble wrap, and the thickness of the
 * carton itself — all of which a seller types as bare board dims, not parcel dims.
 */
export const RESWELL_SHIPPING_AXIS_BUFFER_IN = 2

/**
 * Apply the standard packing buffer to one axis of a bare board dimension.
 *
 * Rule: drop the fractional part of the board value, then add the buffer.
 * Surfboard board dims often come fractional (e.g. `5'10½"`, `2 5/8"`); flooring
 * before adding gives a clean whole-inch parcel dim that carriers prefer:
 *
 *   • 70    → 72   (whole length)
 *   • 70.5  → 72   (5'10½")
 *   • 2.625 → 4    (2 5/8" thickness)
 */
export function applyReswellShippingAxisBuffer(boardValueInches: number): number {
  if (!Number.isFinite(boardValueInches) || boardValueInches <= 0) return boardValueInches
  return Math.floor(boardValueInches) + RESWELL_SHIPPING_AXIS_BUFFER_IN
}

/**
 * Plain numeric parcel length (no `'`) above this triggers concatenated-ft/in parsing on sell save,
 * e.g. mistaken `510` instead of total inches for 5′10″ bare length.
 */
export const RESWELL_PLAIN_PARCEL_LENGTH_REINTERPRET_MIN_IN = 300

/**
 * Sanity bounds on stored carrier-ready parcel inches (quotes fall back to board heuristics if outside).
 */
export const RESWELL_MIN_REASONABLE_STORED_PARCEL_LENGTH_IN = 28
export const RESWELL_MAX_REASONABLE_STORED_PARCEL_LENGTH_IN = 210
export const RESWELL_MIN_REASONABLE_STORED_PARCEL_WIDTH_IN = 10
export const RESWELL_MAX_REASONABLE_STORED_PARCEL_WIDTH_IN = 56
/** Real packed surfboards are often ~2½–6″ tall; rejecting thin boxes discarded sellers’ taped measurements at checkout and forced wrong heuristic packages. */
export const RESWELL_MIN_REASONABLE_STORED_PARCEL_HEIGHT_IN = 2
export const RESWELL_MAX_REASONABLE_STORED_PARCEL_HEIGHT_IN = 42
/** ~56 lb packaged — generous for logs / SUP rails on standard parcel rating. */
export const RESWELL_MAX_REASONABLE_STORED_PARCEL_WEIGHT_OZ = 56 * 16
/** Below this, stored weight is likely missing or wrong (ounces). */
export const RESWELL_MIN_REASONABLE_STORED_PARCEL_WEIGHT_OZ = 16

const KG_PER_LITER_ROUGH = 0.45
const MIN_SHIP_LB = 5
const MAX_SHIP_LB = 45

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
 * Packed L×W×H (inches) estimated from board dimensions for legacy/fallback quotes —
 * same numeric values as the Dimensions section (no automatic extra padding).
 */
export function reswellSuggestedPackageInchesFromBoard(input: {
  boardLength: string
  boardWidthInches: string
  boardThicknessInches: string
}): { lengthIn: string; widthIn: string; heightIn: string } | null {
  const totalLengthIn = totalBoardLengthInchesFromCombinedInput(input.boardLength)
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

  const lenIn = totalLengthIn
  const wIn = wParsed != null && Number.isFinite(wParsed) && wParsed > 0 ? wParsed : null
  const hIn = tParsed != null && Number.isFinite(tParsed) && tParsed > 0 ? tParsed : null

  return {
    lengthIn: formatDecimalDimension(lenIn),
    widthIn: wIn != null ? formatDecimalDimension(wIn) : "",
    heightIn: hIn != null ? formatDecimalDimension(hIn) : "",
  }
}

/**
 * Suggested packed shipping weight (whole pounds + ounces) from length and optional liters.
 */
export function reswellSuggestedShipWeightLbOzFromBoard(input: {
  boardLength: string
  boardVolumeL: string
}): { lb: string; oz: string } | null {
  const totalLengthIn = totalBoardLengthInchesFromCombinedInput(input.boardLength)
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

/**
 * Strings to pre-fill the Reswell packed parcel UI from the Dimensions section (“board” units).
 * Saved values are passed to rating as entered (see `lib/reswell-parcel-fields.ts`).
 */
export function reswellParcelAutofillStringsFromBoard(input: {
  boardLength: string
  boardWidthInches: string
  boardThicknessInches: string
}): { length: string; width: string; height: string } | null {
  if (totalBoardLengthInchesFromCombinedInput(input.boardLength) == null) return null

  const width = input.boardWidthInches.trim()
  const height = input.boardThicknessInches.trim()

  if (width) {
    const wParsed =
      parseBoardMeasurement(width) ?? Number.parseFloat(width.replace(/\s+/g, "").replace(/,/g, ""))
    if (!Number.isFinite(wParsed) || wParsed <= 0) return null
  }
  if (height) {
    const hParsed =
      parseBoardMeasurement(height) ?? Number.parseFloat(height.replace(/\s+/g, "").replace(/,/g, ""))
    if (!Number.isFinite(hParsed) || hParsed <= 0) return null
  }

  return {
    length: input.boardLength.trim(),
    width,
    height,
  }
}
