/**
 * Shared parsing/formatting for surfboard dimensions on the sell flow.
 * Accepts decimals and common fraction forms (e.g. "19 1/2", "2 1/4").
 */

export function formatDecimalDimension(value: number): string {
  if (!Number.isFinite(value)) return ""
  return Number.isInteger(value) ? String(value) : String(Number(value.toFixed(3)))
}

/** Whole feet from the feet input. */
export function parseLengthFeet(input: string): number | null {
  const t = input.trim()
  if (!t) return null
  const n = Number.parseInt(t, 10)
  return Number.isFinite(n) ? n : null
}

/**
 * Parse a single measurement: plain decimal, mixed fraction ("19 1/2"), or simple fraction ("3/4").
 */
export function parseBoardMeasurement(input: string): number | null {
  const normalized = input.trim()
  if (!normalized) return null
  if (/^\d*\.?\d+$/.test(normalized)) {
    const decimal = Number.parseFloat(normalized)
    return Number.isFinite(decimal) ? decimal : null
  }

  const mixedFraction = normalized.match(/^(\d+)\s+(\d+)\/(\d+)$/)
  if (mixedFraction) {
    const whole = Number.parseInt(mixedFraction[1], 10)
    const numerator = Number.parseInt(mixedFraction[2], 10)
    const denominator = Number.parseInt(mixedFraction[3], 10)
    if (!denominator || numerator >= denominator) return null
    return whole + numerator / denominator
  }

  const fraction = normalized.match(/^(\d+)\/(\d+)$/)
  if (fraction) {
    const numerator = Number.parseInt(fraction[1], 10)
    const denominator = Number.parseInt(fraction[2], 10)
    if (!denominator || numerator >= denominator) return null
    return numerator / denominator
  }

  return null
}

/** Liters: leading number, optional unit suffix (e.g. "25", "25 L", "~32.5"). */
export function parseVolumeLiters(input: string): number | null {
  const t = input.trim().replace(/,/g, "")
  if (!t) return null
  const m = t.match(/^[\s~]*(\d+\.?\d*)/)
  if (!m) return null
  const v = Number.parseFloat(m[1])
  return Number.isFinite(v) && v > 0 ? v : null
}

/** Title / display: `6'2"` style from feet + inches string fields. */
export function formatBoardLengthForTitle(boardLengthFt: string, boardLengthIn: string): string {
  const ft = parseLengthFeet(boardLengthFt)
  if (ft == null) return ""
  const inRaw = boardLengthIn.trim() === "" ? "0" : boardLengthIn.trim()
  const inchesNum = parseBoardMeasurement(inRaw) ?? Number.parseFloat(inRaw)
  if (!Number.isFinite(inchesNum)) return ""
  return `${ft}'${formatDecimalDimension(inchesNum)}"`
}

export type BoardDimensionsDbFields = {
  length_feet: number | null
  length_inches: number | null
  width: number | null
  thickness: number | null
  volume: number | null
}

export function boardDimensionsToDbFields(input: {
  boardLengthFt: string
  boardLengthIn: string
  boardWidthInches: string
  boardThicknessInches: string
  boardVolumeL: string
}): BoardDimensionsDbFields {
  const ft = parseLengthFeet(input.boardLengthFt)
  const inRaw = input.boardLengthIn.trim() === "" ? "0" : input.boardLengthIn.trim()
  const inches = parseBoardMeasurement(inRaw) ?? Number.parseFloat(inRaw)
  const w =
    parseBoardMeasurement(input.boardWidthInches.trim()) ??
    Number.parseFloat(input.boardWidthInches.trim())
  const t =
    parseBoardMeasurement(input.boardThicknessInches.trim()) ??
    Number.parseFloat(input.boardThicknessInches.trim())
  const volRaw = input.boardVolumeL.trim()
  const volume = volRaw ? parseVolumeLiters(volRaw) : null
  return {
    length_feet: ft,
    length_inches: ft != null && Number.isFinite(inches) ? inches : null,
    width: Number.isFinite(w) ? w : null,
    thickness: Number.isFinite(t) ? t : null,
    volume,
  }
}
