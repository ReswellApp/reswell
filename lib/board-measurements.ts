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
 * Largest width (in) from a sell-form width field — handles nose×tail ranges like `18 x 22`.
 * Used for carrier limits so checkout never under-rates the wide end of the board.
 */
export function maxBoardWidthInchesFromInput(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null

  if (/[x×]/iu.test(trimmed)) {
    const parts = trimmed.split(/\s*[x×]\s*/iu).filter(Boolean)
    let max: number | null = null
    for (const part of parts) {
      const token = part.trim()
      if (!token) continue
      const v =
        parseBoardMeasurement(token) ??
        Number.parseFloat(token.replace(/\s+/g, "").replace(/,/g, ""))
      if (Number.isFinite(v) && v > 0) {
        max = max == null ? v : Math.max(max, v)
      }
    }
    return max
  }

  const single =
    parseBoardMeasurement(trimmed) ??
    Number.parseFloat(trimmed.replace(/\s+/g, "").replace(/,/g, ""))
  return Number.isFinite(single) && single > 0 ? single : null
}

/**
 * Parse a single measurement: plain decimal, mixed fraction ("19 1/2"), or simple fraction ("3/4").
 */
export function parseBoardMeasurement(input: string): number | null {
  const trimmed = input.trim()
  if (!trimmed) return null
  let normalized = trimmed
  if (!normalized.includes("/")) {
    if (/^\d+,\d+$/.test(normalized)) {
      normalized = normalized.replace(/^(\d+),(\d+)$/, "$1.$2")
    } else {
      normalized = normalized.replace(/,/g, "")
    }
  } else {
    normalized = normalized.replace(/,/g, "")
  }
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

/**
 * Split an inches field into whole + fraction parts for UI where "/" is always visible
 * between numerator and denominator (e.g. `2 5/16`, `19 1/2`, or `19` alone).
 * Supports partial entry `19 1` while the denominator is still being typed.
 */
export function splitInchesFractionFields(raw: string): {
  whole: string
  numerator: string
  denominator: string
} {
  const t = raw.trim()
  if (!t) return { whole: "", numerator: "", denominator: "" }

  if (t.includes("/")) {
    const mixed = t.match(/^(\d+(?:\.\d+)?)\s+(\d+)\/(\d+)$/)
    if (mixed) {
      return { whole: mixed[1], numerator: mixed[2], denominator: mixed[3] }
    }
    const simple = t.match(/^(\d+)\/(\d+)$/)
    if (simple) {
      return { whole: "", numerator: simple[1], denominator: simple[2] }
    }
  }

  const partial = t.match(/^(\d+(?:\.\d+)?)\s+(\d+)$/)
  if (partial && !t.includes("/")) {
    return { whole: partial[1], numerator: partial[2], denominator: "" }
  }

  if (/^\d*\.?\d+$/.test(t)) {
    return { whole: t, numerator: "", denominator: "" }
  }

  return { whole: t, numerator: "", denominator: "" }
}

/** Inverse of {@link splitInchesFractionFields} for controlled inputs. */
export function combineInchesFractionFields(
  whole: string,
  numerator: string,
  denominator: string,
): string {
  const w = whole.trim()
  const n = numerator.trim().replace(/\D/g, "")
  const d = denominator.trim().replace(/\D/g, "")

  if (w.includes(".")) {
    return w
  }

  if (n && d) {
    return w ? `${w} ${n}/${d}` : `${n}/${d}`
  }
  if (n && !d) {
    return w ? `${w} ${n}` : n
  }
  return w
}

const BOARD_DIM_INCHES_INPUT_MAX = 80
const BOARD_DIM_VOLUME_L_INPUT_MAX = 48

function stripInvis(s: string): string {
  return s.replace(
    /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u200B-\u200D\uFEFF]/g,
    "",
  )
}

function normalizeTypographicToAsciiMath(s: string): string {
  return s
    .replace(/\u2044/g, "/")
    .replace(/[／﹨]/g, "/")
    .replace(/[\uFF0E\u2024\u00B7]/g, ".")
}

const BOARD_LENGTH_INPUT_MAX = 80

/**
 * **Width and thickness (in):** true freeform while typing — no stripping letters or punctuation.
 * We only remove invisible characters, map common unicode fraction/decimal glyphs, trim leading
 * space, and cap length. {@link parseBoardMeasurement} and validation interpret the value on save.
 */
export function normalizeTapeStyleInchesInput(raw: string): string {
  if (!/\S/.test(raw)) return ""
  let s = stripInvis(raw).replace(/^\s+/, "")
  s = normalizeTypographicToAsciiMath(s)
  if (s.length > BOARD_DIM_INCHES_INPUT_MAX) s = s.slice(0, BOARD_DIM_INCHES_INPUT_MAX)
  return s
}

/** @deprecated Prefer {@link normalizeTapeStyleInchesInput} — alias kept for existing imports. */
export const normalizeBoardWidthInchesInput = normalizeTapeStyleInchesInput

/** True while only a single foot digit is present (before `'` / inches) — show inch placeholder hint. */
export function shouldShowLengthInchHint(raw: string): boolean {
  const t = raw.trim()
  if (!t) return false
  if (t.includes("'")) return false
  return /^\d$/.test(t)
}

/**
 * **Volume (L):** freeform — we only strip invisible characters, normalize common unicode
 * decimal/separator glyphs, trim leading space, and cap length. Parsers (see
 * {@link parseVolumeLiters}) find the first plausible number, including in strings like
 * `approx 32.5` or `32,4 L`.
 */
export function normalizeVolumeLitersInput(raw: string): string {
  if (!/\S/.test(raw)) return ""
  let t = stripInvis(raw).replace(/^\s+/, "")
  t = normalizeTypographicToAsciiMath(t)
  if (t.length > BOARD_DIM_VOLUME_L_INPUT_MAX) t = t.slice(0, BOARD_DIM_VOLUME_L_INPUT_MAX)
  return t
}

/** Liters: first number in the string (or leading after ~ with optional L suffix). */
export function parseVolumeLiters(input: string): number | null {
  let t = input.trim()
  if (!t) return null
  if (/^\d+,\d+$/.test(t)) t = t.replace(/^(\d+),(\d+)$/, "$1.$2")
  else t = t.replace(/,/g, "")

  let m = t.match(/^[\s~]*(\d+\.?\d*)/)
  if (!m) m = t.match(/(\d+\.?\d*)/)
  if (!m) return null
  const v = Number.parseFloat(m[1])
  return Number.isFinite(v) && v > 0 ? v : null
}

/**
 * Sell flow: length is “complete” when it passes the same inch rules as sell validation
 * (feet 1–15, inches present, under 12).
 */
export function isBoardLengthEntryComplete(raw: string): boolean {
  const lenRaw = raw.trim()
  if (!lenRaw) return false
  const { feetStr, inchesStr } = parseBoardLengthParts(lenRaw)
  if (!feetStr.trim()) return false
  if (inchesStr.trim() === "") return false
  const ft = parseLengthFeet(feetStr)
  if (ft == null || ft < 1 || ft > 15) return false
  const inches =
    parseBoardMeasurement(inchesStr.trim()) ?? Number.parseFloat(inchesStr.trim())
  if (!Number.isFinite(inches) || inches < 0 || inches >= 12) return false
  return true
}

/**
 * Width/thickness: a positive measurement parses as a number (decimal, fraction, or plain integer string).
 */
export function isTapeStyleInchesEntryComplete(raw: string): boolean {
  const t = raw.trim()
  if (!t) return false
  const v = parseBoardMeasurement(t) ?? Number.parseFloat(t)
  return Number.isFinite(v) && v > 0
}

/** Liters: a positive value parses. */
export function isVolumeLitersEntryComplete(raw: string): boolean {
  return parseVolumeLiters(raw) != null
}

/**
 * Split a combined length for validation and storage (`6'2`, `6 2`, or digit run `62` as 6 ft + 2 in when no `'`).
 * The sell input normalizer no longer rewrites the display value to insert `'` — that happens here only for parsing.
 */
export function parseBoardLengthParts(raw: string): { feetStr: string; inchesStr: string } {
  const t = raw.trim()
  if (!t) return { feetStr: "", inchesStr: "" }
  const normalized = t.replace(/[\u2032\u2019＇]/g, "'")

  if (normalized.includes("'")) {
    const idx = normalized.indexOf("'")
    const feetStr = normalized.slice(0, idx).replace(/\D/g, "")
    let inchesStr = normalized.slice(idx + 1).trim()
    inchesStr = inchesStr.replace(/^["\u201c\u201d]+|["\u201c\u201d]+$/g, "").trim()
    return { feetStr, inchesStr }
  }

  // Feet and inches separated by a dot (e.g. 5.10, 6.2) — not a fractional inch string.
  const dotParts = normalized.match(/^(\d{1,2})\.(\d{1,2})$/)
  if (dotParts && !normalized.includes("/")) {
    const inchesVal = Number.parseInt(dotParts[2], 10)
    if (Number.isFinite(inchesVal) && inchesVal >= 0 && inchesVal < 12) {
      return { feetStr: dotParts[1], inchesStr: dotParts[2] }
    }
  }

  const spaceParts = normalized.split(/\s+/).filter(Boolean)
  if (spaceParts.length >= 2) {
    const feetStr = spaceParts[0].replace(/\D/g, "")
    const inchesStr = spaceParts.slice(1).join(" ").trim()
    return { feetStr, inchesStr }
  }

  const digits = normalized.replace(/\D/g, "")
  if (digits === "") return { feetStr: "", inchesStr: "" }
  if (digits.length === 1) return { feetStr: digits, inchesStr: "" }
  const two = digits.slice(0, 2)
  const n = Number.parseInt(two, 10)
  if (n >= 10 && n <= 15) {
    return { feetStr: two, inchesStr: digits.slice(2) }
  }
  return { feetStr: digits.slice(0, 1), inchesStr: digits.slice(1) }
}

/**
 * **Length (ft/in):** freeform. Feet left of the first `'` stay digits-only for parsing; the inch
 * segment is not character-restricted. We strip invisible bytes and normalize typographic
 * quotes/slashes/dots, trim leading space, and cap total length.
 */
export function normalizeBoardLengthInput(raw: string): string {
  let t = stripInvis(raw).replace(/[\u2032\u2019＇]/g, "'")
  t = t.replace(/[\u201c\u201d\u2033\uFF02]/g, '"')
  if (t.includes("'")) {
    const i = t.indexOf("'")
    const left = t.slice(0, i).replace(/\D/g, "")
    let right = t.slice(i + 1)
    right = normalizeTypographicToAsciiMath(right)
    if (right.length + left.length + 1 > BOARD_LENGTH_INPUT_MAX) {
      right = right.slice(0, Math.max(0, BOARD_LENGTH_INPUT_MAX - left.length - 1))
    }
    return `${left}'${right}`
  }
  t = normalizeTypographicToAsciiMath(t)
  t = t.replace(/^\s+/, "")
  if (t.length > BOARD_LENGTH_INPUT_MAX) t = t.slice(0, BOARD_LENGTH_INPUT_MAX)
  return t
}

/**
 * Canonical `5'10` token when feet and inches parse like listing storage / sell validation.
 * Returns null for partial entry (feet only) or unparseable input.
 */
export function canonicalBoardLengthFilterToken(raw: string): string | null {
  const t = normalizeBoardLengthInput(raw).trim()
  if (!t) return null
  const { feetStr, inchesStr } = parseBoardLengthParts(t)
  if (!feetStr.trim()) return null
  const ft = parseLengthFeet(feetStr)
  if (ft == null || ft < 1 || ft > 15) return null
  if (inchesStr.trim() === "") return null
  const inRaw = inchesStr.trim()
  const inches = parseBoardMeasurement(inRaw) ?? Number.parseFloat(inRaw)
  if (!Number.isFinite(inches) || inches < 0 || inches >= 12) return null
  return `${feetStr}'${inRaw}`
}

/** Token for `listings.dimensions` ilike — canonical when complete, else normalized raw. */
export function boardLengthFilterToken(raw: string): string {
  const normalized = normalizeBoardLengthInput(raw).trim()
  if (!normalized) return ""
  return canonicalBoardLengthFilterToken(raw) ?? normalized
}

/** Hydrate combined length from legacy feet + inches fields or listing row parts. */
export function formatBoardLengthInputFromParts(feetStr: string, inchesStr: string): string {
  const fd = feetStr.trim().replace(/\D/g, "")
  const ir = inchesStr.trim()
  if (!fd) return ""
  if (!ir) {
    const n = Number.parseInt(fd, 10)
    if (fd.length === 2 && Number.isFinite(n) && n >= 10 && n <= 15) return `${fd}'`
    return fd
  }
  return `${fd}'${ir}`
}

/**
 * Surfboard overall length in inches from the combined length field (`6'1`, `611` → 6′11″ semantics, etc.).
 * Matches sell validation rules (feet 1–15, fractional inches allowed, under 12 in the inch segment).
 */
export function totalBoardLengthInchesFromCombinedInput(boardLength: string): number | null {
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

/** Title / display: `6'2"` style from a combined length field. */
export function formatBoardLengthForTitle(boardLength: string): string {
  const { feetStr, inchesStr } = parseBoardLengthParts(boardLength)
  const ft = parseLengthFeet(feetStr)
  if (ft == null) return ""
  const inRaw = inchesStr.trim() === "" ? "0" : inchesStr.trim()
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

/** Trimmed sell-form strings for listing detail (fractions preserved). */
export type BoardDimensionDisplayFields = {
  length_inches_display: string | null
  width_inches_display: string | null
  thickness_inches_display: string | null
  volume_display: string | null
}

function trimDimensionDisplay(raw: string): string | null {
  const t = raw.trim().slice(0, 80)
  return t === "" ? null : t
}

export function boardDimensionDisplayFields(input: {
  boardLength: string
  boardWidthInches: string
  boardThicknessInches: string
  boardVolumeL: string
}): BoardDimensionDisplayFields {
  const { inchesStr } = parseBoardLengthParts(input.boardLength)
  return {
    length_inches_display: trimDimensionDisplay(inchesStr),
    width_inches_display: trimDimensionDisplay(input.boardWidthInches),
    thickness_inches_display: trimDimensionDisplay(input.boardThicknessInches),
    volume_display: trimDimensionDisplay(input.boardVolumeL),
  }
}

export function boardDimensionsToDbFields(input: {
  boardLength: string
  boardWidthInches: string
  boardThicknessInches: string
  boardVolumeL: string
}): BoardDimensionsDbFields {
  const { feetStr, inchesStr } = parseBoardLengthParts(input.boardLength)
  const ft = parseLengthFeet(feetStr)
  const inRaw = inchesStr.trim() === "" ? "0" : inchesStr.trim()
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
