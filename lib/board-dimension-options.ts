/**
 * Prebuilt surfboard dimension option lists for the sell-flow picker.
 * Values match sell-form storage (`5'10`, `19 3/4`, `2 1/2`); labels include inch marks.
 */

import {
  formatBoardLengthInputFromParts,
  formatInchesDecimalDisplay,
  parseBoardLengthParts,
  parseBoardMeasurement,
  parseLengthFeet,
} from "@/lib/board-measurements"

export type BoardDimensionOption = {
  /** Stored sell-form value */
  value: string
  /** Dropdown / bar display label */
  label: string
}

function gcd(a: number, b: number): number {
  let x = Math.abs(a)
  let y = Math.abs(b)
  while (y) {
    const t = y
    y = x % y
    x = t
  }
  return x || 1
}

/**
 * Format a positive inch measurement as a reduced mixed fraction with `"`.
 * e.g. 19.75 → `19 3/4"`, 2.5 → `2 1/2"`, 20 → `20"`
 */
export function formatInchesFractionLabel(inches: number): string {
  if (!Number.isFinite(inches) || inches < 0) return ""
  const whole = Math.floor(inches + 1e-9)
  const frac = inches - whole
  if (frac < 1e-9) return `${whole}"`

  // Prefer sixteenth, then eighth, then quarter, then half.
  const sixteenths = Math.round(frac * 16)
  if (sixteenths <= 0) return `${whole}"`
  if (sixteenths >= 16) return `${whole + 1}"`

  const d = gcd(sixteenths, 16)
  const num = sixteenths / d
  const den = 16 / d
  if (whole === 0) return `${num}/${den}"`
  return `${whole} ${num}/${den}"`
}

/** Storage value without the trailing inch mark (matches tape-style sell inputs). */
export function formatInchesFractionValue(inches: number): string {
  const label = formatInchesFractionLabel(inches)
  return label.endsWith('"') ? label.slice(0, -1) : label
}

/** Same measurement as {@link formatInchesFractionLabel}, shown as a decimal (`19.75"`). */
export function formatInchesDecimalLabel(inches: number): string {
  return formatInchesDecimalDisplay(inches)
}

/**
 * Keep stored fraction values (`19 3/4`) so toggling notation does not change
 * the listing; only the dropdown labels become decimals.
 */
export function withInchesDecimalLabels(
  options: readonly BoardDimensionOption[],
): BoardDimensionOption[] {
  return options.map((opt) => {
    const n = parseBoardMeasurement(opt.value)
    if (n == null || n <= 0) return opt
    return { value: opt.value, label: formatInchesDecimalLabel(n) }
  })
}

/** Length bar/dropdown label: `5' 10"` (space between feet and inches). */
export function formatBoardLengthPickerLabel(boardLength: string): string {
  const { feetStr, inchesStr } = parseBoardLengthParts(boardLength)
  const ft = parseLengthFeet(feetStr)
  if (ft == null) return ""
  const inRaw = inchesStr.trim() === "" ? "0" : inchesStr.trim()
  const inchesNum = parseBoardMeasurement(inRaw) ?? Number.parseFloat(inRaw)
  if (!Number.isFinite(inchesNum) || inchesNum < 0 || inchesNum >= 12) return ""
  const inchLabel = formatInchesFractionLabel(inchesNum)
  return `${ft}' ${inchLabel}`
}

const LENGTH_FEET_MIN = 4
const LENGTH_FEET_MAX = 12

/** Length options from 4'0" … 12'0" in whole-inch steps. */
export function buildBoardLengthOptions(): BoardDimensionOption[] {
  const options: BoardDimensionOption[] = []
  for (let ft = LENGTH_FEET_MIN; ft <= LENGTH_FEET_MAX; ft++) {
    const inchMax = ft === LENGTH_FEET_MAX ? 0 : 11
    for (let inch = 0; inch <= inchMax; inch++) {
      const value = formatBoardLengthInputFromParts(String(ft), String(inch))
      options.push({
        value,
        label: formatBoardLengthPickerLabel(value),
      })
    }
  }
  return options
}

const WIDTH_IN_MIN = 15
const WIDTH_IN_MAX = 25
const WIDTH_STEP = 1 / 8

/** Width options 15" … 25" in ⅛" steps. */
export function buildBoardWidthOptions(): BoardDimensionOption[] {
  const options: BoardDimensionOption[] = []
  for (let n = Math.round(WIDTH_IN_MIN / WIDTH_STEP); n <= Math.round(WIDTH_IN_MAX / WIDTH_STEP); n++) {
    const inches = n * WIDTH_STEP
    options.push({
      value: formatInchesFractionValue(inches),
      label: formatInchesFractionLabel(inches),
    })
  }
  return options
}

const THICKNESS_IN_MIN = 1.5
const THICKNESS_IN_MAX = 4.5
const THICKNESS_STEP = 1 / 16

/** Thickness options 1½" … 4½" in ¹⁄₁₆" steps. */
export function buildBoardThicknessOptions(): BoardDimensionOption[] {
  const options: BoardDimensionOption[] = []
  for (
    let n = Math.round(THICKNESS_IN_MIN / THICKNESS_STEP);
    n <= Math.round(THICKNESS_IN_MAX / THICKNESS_STEP);
    n++
  ) {
    const inches = n * THICKNESS_STEP
    options.push({
      value: formatInchesFractionValue(inches),
      label: formatInchesFractionLabel(inches),
    })
  }
  return options
}

/** Snap a raw inches string onto the nearest option value, or null if unparseable. */
export function matchBoardInchesOptionValue(
  raw: string,
  options: readonly BoardDimensionOption[],
): string | null {
  const t = raw.trim()
  if (!t) return null
  const exact = options.find((o) => o.value === t || o.label === t || o.label === `${t}"`)
  if (exact) return exact.value

  const parsed = parseBoardMeasurement(t) ?? Number.parseFloat(t)
  if (!Number.isFinite(parsed) || parsed <= 0) return null

  let best: BoardDimensionOption | null = null
  let bestDelta = Infinity
  for (const opt of options) {
    const optNum = parseBoardMeasurement(opt.value)
    if (optNum == null) continue
    const delta = Math.abs(optNum - parsed)
    if (delta < bestDelta) {
      bestDelta = delta
      best = opt
    }
  }
  // Only snap when within half a sixteenth (covers float noise + near-miss decimals).
  if (best && bestDelta <= 1 / 32) return best.value
  return null
}

/** Snap a combined length string onto a prebuilt length option value. */
export function matchBoardLengthOptionValue(
  raw: string,
  options: readonly BoardDimensionOption[],
): string | null {
  const t = raw.trim()
  if (!t) return null
  const exact = options.find((o) => o.value === t)
  if (exact) return exact.value

  const { feetStr, inchesStr } = parseBoardLengthParts(t)
  const ft = parseLengthFeet(feetStr)
  if (ft == null) return null
  const inRaw = inchesStr.trim() === "" ? "0" : inchesStr.trim()
  const inches = parseBoardMeasurement(inRaw) ?? Number.parseFloat(inRaw)
  if (!Number.isFinite(inches) || inches < 0 || inches >= 12) return null

  const roundedInches = Math.round(inches)
  if (Math.abs(inches - roundedInches) > 1 / 32) return null
  const canonical = formatBoardLengthInputFromParts(String(ft), String(roundedInches))
  return options.some((o) => o.value === canonical) ? canonical : null
}

/** Ensure a custom (off-grid) value still appears in the select. */
export function withCurrentDimensionOption(
  options: readonly BoardDimensionOption[],
  currentRaw: string,
  kind: "length" | "inches",
): BoardDimensionOption[] {
  const t = currentRaw.trim()
  if (!t) return [...options]
  if (options.some((o) => o.value === t)) return [...options]

  const label =
    kind === "length"
      ? formatBoardLengthPickerLabel(t) || t
      : t.endsWith('"')
        ? t
        : `${t}"`

  return [{ value: t, label }, ...options]
}

export const BOARD_LENGTH_OPTIONS = buildBoardLengthOptions()
export const BOARD_WIDTH_OPTIONS = buildBoardWidthOptions()
export const BOARD_THICKNESS_OPTIONS = buildBoardThicknessOptions()

/**
 * Menu open anchors — lists open centered here so sellers scroll both ways
 * from a typical shortboard / mid-range starting point (not from 4'0" / 15").
 */
export const BOARD_LENGTH_FOCUS_VALUE = "6'0"
/** Most boards land ~18–23"; open width menus on 19". */
export const BOARD_WIDTH_FOCUS_VALUE = "19"
export const BOARD_THICKNESS_FOCUS_VALUE = "2 1/2"
