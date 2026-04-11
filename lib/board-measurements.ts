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

/** Single `.`, digits elsewhere — tape decimal branch and {@link normalizeVolumeLitersInput}. */
function sanitizeDecimalLiteralInput(raw: string): string {
  const noBad = raw.replace(/[^\d.]/g, "")
  const firstDot = noBad.indexOf(".")
  if (firstDot === -1) return noBad
  return noBad.slice(0, firstDot + 1) + noBad.slice(firstDot + 1).replace(/\./g, "")
}

/**
 * Digit-only liters: insert a decimal as soon as the run is long enough (`304` → `30.4`, `3045` → `30.45`).
 * Round hundreds stay literal so `100` can still mean 100 L.
 */
function inferVolumeLitersDigitRun(stripped: string): string {
  if (stripped.length === 3) {
    if (stripped === "100" || stripped === "200" || stripped === "300") return stripped
    return `${stripped.slice(0, 2)}.${stripped[2]}`
  }
  if (stripped.length === 4) {
    return `${stripped.slice(0, 2)}.${stripped.slice(2)}`
  }
  if (stripped.length === 5) {
    return `${stripped.slice(0, 3)}.${stripped.slice(3)}`
  }
  return stripped
}

/** Tape-style inch fractions only: small numerators, denominators like /8 … /128 — not arbitrary long tails. */
const TAPE_INCH_NUM_MAX_DIGITS = 2
const TAPE_INCH_DEN_MAX_DIGITS = 3
const TAPE_INCH_DEN_MAX_VALUE = 128
/** Upper bound for two-digit whole inches in digit-only inference (e.g. `1914` → `19 1/4`). */
const TAPE_INCH_TWO_DIGIT_WHOLE_MAX = 48

function clampDenominatorDigits(denRaw: string): string {
  let d = denRaw.replace(/\D/g, "").slice(0, TAPE_INCH_DEN_MAX_DIGITS)
  if (d === "") return ""
  let v = Number.parseInt(d, 10)
  while (d.length > 1 && (v > TAPE_INCH_DEN_MAX_VALUE || v < 1)) {
    d = d.slice(0, -1)
    v = Number.parseInt(d, 10)
  }
  if (v > TAPE_INCH_DEN_MAX_VALUE) return String(TAPE_INCH_DEN_MAX_VALUE)
  if (v < 1) return ""
  return d
}

/**
 * Keep tape-style inch fields (width, thickness) close to real formats (`2 3/8`, `2 5/16`, `19 1/2`):
 * cap digit runs after `/` and enforce numerator/denominator bounds.
 */
function clampTapeMeasureInches(s: string): string {
  const t = s.trim()
  if (!t || t.includes(".")) return s

  const simple = t.match(/^(\d{1,2})\/(\d+)$/)
  if (simple) {
    let num = simple[1].slice(0, TAPE_INCH_NUM_MAX_DIGITS)
    const den = clampDenominatorDigits(simple[2])
    if (!den) return t
    let nv = Number.parseInt(num, 10)
    const dv = Number.parseInt(den, 10)
    if (nv >= dv) {
      num = String(Math.max(0, dv - 1))
      nv = Number.parseInt(num, 10)
    }
    return `${num}/${den}`
  }

  const mixed = t.match(/^(\d{1,2})\s+(\d+)\/(\d+)$/)
  if (!mixed) return s

  const w = mixed[1].slice(0, 2)
  let num = mixed[2].slice(0, TAPE_INCH_NUM_MAX_DIGITS)
  const den = clampDenominatorDigits(mixed[3])
  if (!den) {
    return `${w} ${num}`.trim()
  }
  let nv = Number.parseInt(num, 10)
  const dv = Number.parseInt(den, 10)
  if (nv >= dv) {
    num = String(Math.max(0, dv - 1))
    nv = Number.parseInt(num, 10)
  }
  if (!Number.isFinite(nv) || nv < 0) return `${w} ${den}`
  return `${w} ${num}/${den}`
}

/**
 * Single-field UX for **width and thickness** (same spirit as length): type digits and spaces; `/` is inserted
 * for common tape patterns (`2 5/16`, `2 3/8`, `19 1/4`, `19 1/2`). Digit-only entry works too: `2516` → `2 5/16`,
 * `238` → `2 3/8`, `1914` → `19 1/4`, `1912` → `19 1/2` when the result is a valid fraction.
 */
export function normalizeTapeStyleInchesInput(raw: string): string {
  const t = raw.replace(/\u2044/g, "/").replace(/[／]/g, "/")
  const trimmed = t.trim()
  if (trimmed === "") return ""

  const decCandidate = trimmed.replace(/[^\d.]/g, "")
  if (decCandidate.includes(".")) {
    return sanitizeDecimalLiteralInput(decCandidate)
  }

  let s = trimmed.replace(/[^\d\s/]/g, "").replace(/\s+/g, " ")

  if (s.includes("/")) {
    const compact = s.replace(/\s*\/\s*/g, "/")
    const simple = compact.match(/^(\d+)\/(\d+)$/)
    if (simple) return clampTapeMeasureInches(`${simple[1]}/${simple[2]}`)
    const mixed = compact.match(/^(\d+)\s+(\d+)\/(\d+)$/)
    if (mixed) return clampTapeMeasureInches(`${mixed[1]} ${mixed[2]}/${mixed[3]}`)
    return clampTapeMeasureInches(compact)
  }

  const parts = s.split(" ").filter(Boolean)
  if (parts.length === 3 && parts.every((p) => /^\d+$/.test(p))) {
    return clampTapeMeasureInches(`${parts[0]} ${parts[1]}/${parts[2]}`)
  }
  if (parts.length === 2 && parts.every((p) => /^\d+$/.test(p))) {
    const [a, b] = parts
    if (b.length >= 3) {
      return clampTapeMeasureInches(`${a} ${b[0]}/${b.slice(1)}`)
    }
    if (a.length >= 2 && b.length === 2) {
      return clampTapeMeasureInches(`${a} ${b[0]}/${b[1]}`)
    }
    return `${a} ${b}`
  }

  const digits = s.replace(/\D/g, "")
  if (digits.length === 0) return ""
  if (!/^\d+$/.test(digits)) return s

  return clampTapeMeasureInches(inferWidthDigitsSmooth(digits))
}

/** @deprecated Prefer {@link normalizeTapeStyleInchesInput} — alias kept for existing imports. */
export const normalizeBoardWidthInchesInput = normalizeTapeStyleInchesInput

function inferWidthDigitsSmooth(d: string): string {
  if (d.length < 3) return d

  /** Three digits only: `238` → `2 3/8`, `251` → `2 5/1` invalid → keep raw */
  if (d.length === 3) {
    const cand = `${d[0]} ${d[1]}/${d[2]}`
    if (parseBoardMeasurement(cand) != null) return cand
    return d
  }

  if (d.length === 4) {
    const tail = d.slice(2)
    // Single-digit whole + /16 /32 /64 (must run before two-digit-whole so `2516` → `2 5/16`, not `25 1/6`)
    if ("23456789".includes(d[0]) && (tail === "16" || tail === "32" || tail === "64")) {
      const sixteenth = `${d[0]} ${d[1]}/${tail}`
      if (parseBoardMeasurement(sixteenth) != null) return sixteenth
    }
    const ww = d.slice(0, 2)
    const nWW = Number.parseInt(ww, 10)
    const twoDigitMixed = `${ww} ${d[2]}/${d[3]}`
    if (
      nWW >= 10 &&
      nWW <= TAPE_INCH_TWO_DIGIT_WHOLE_MAX &&
      parseBoardMeasurement(twoDigitMixed) != null
    ) {
      return twoDigitMixed
    }
    const oneDigitWhole = `${d[0]} ${d[1]}/${tail}`
    if (parseBoardMeasurement(oneDigitWhole) != null) return oneDigitWhole
    return d
  }

  if (d.length >= 5) {
    const w2 = d.slice(0, 2)
    const rest = d.slice(2)
    if (rest.length >= 3) {
      return `${w2} ${rest[0]}/${rest.slice(1)}`
    }
  }

  return d
}

/** True while only a single foot digit is present (before `'` / inches) — show inch placeholder hint. */
export function shouldShowLengthInchHint(raw: string): boolean {
  const t = raw.trim()
  if (!t) return false
  if (t.includes("'")) return false
  return /^\d$/.test(t)
}

/**
 * Sell-flow volume field: decimals only (`30.4`, `~32.5`), optional trailing `L`, optional `~` prefix.
 * Digit-only entry inserts the decimal (`304` → `30.4`) once 3–5 digits are typed, like tape-style inches.
 * Commas stripped or treated as decimal comma when unambiguous.
 */
export function normalizeVolumeLitersInput(raw: string): string {
  let t = raw.trim()
  if (t === "") return ""

  let approx = ""
  if (t.startsWith("~")) {
    approx = "~"
    t = t.slice(1).trim()
  }

  t = t.replace(/\s*[lL]\s*$/u, "").trim()

  const compact = t.replace(/\s/g, "")
  if (compact !== "" && !compact.includes(".") && /^\d+,\d+$/.test(compact)) {
    t = compact.replace(",", ".")
  } else {
    t = t.replace(/,/g, "")
  }

  t = t.replace(/[^\d.]/g, "")

  if (!t.includes(".")) {
    const onlyDigits = t
    if (/^\d+$/.test(onlyDigits)) {
      const stripped = onlyDigits.replace(/^0+/, "") || "0"
      if (stripped.length >= 3 && stripped.length <= 5) {
        t = inferVolumeLitersDigitRun(stripped)
      } else {
        t = onlyDigits
      }
    }
  }

  const num = sanitizeDecimalLiteralInput(t)
  if (num === "") return approx

  return `${approx}${num}`
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
 * Tape-style width/thickness: advance only once there is a decimal or a fraction slash,
 * so digit-only entry can finish normalizing (e.g. `1914` → `19 1/4`) without jumping early.
 */
export function isTapeStyleInchesEntryComplete(raw: string): boolean {
  const t = raw.trim()
  if (!t) return false
  const v = parseBoardMeasurement(t) ?? Number.parseFloat(t)
  if (!Number.isFinite(v) || v <= 0) return false
  return t.includes("/") || t.includes(".")
}

/** Liters field: require a decimal point so `30` can become `30.4` via inference before we advance. */
export function isVolumeLitersEntryComplete(raw: string): boolean {
  const t = raw.trim()
  if (!t) return false
  if (parseVolumeLiters(t) == null) return false
  return t.includes(".")
}

/**
 * Split a combined length like `6'2`, `10'8`, `6'2 1/2`, or digit-only `62` → 6'2.
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
 * Single-field sell UX: keep a literal `'` in the value and auto-insert it while typing digits
 * (e.g. `62` → `6'2`, `108` → `10'8`) so users do not hunt for the apostrophe key.
 */
export function normalizeBoardLengthInput(raw: string): string {
  const t = raw.replace(/[\u2032\u2019＇]/g, "'")
  if (t.includes("'")) {
    const i = t.indexOf("'")
    const left = t.slice(0, i).replace(/\D/g, "")
    const right = t.slice(i + 1)
    return `${left}'${right}`
  }
  const spaceParts = t.trim().split(/\s+/).filter(Boolean)
  if (spaceParts.length >= 2) {
    const feetStr = spaceParts[0].replace(/\D/g, "")
    const inchesStr = spaceParts.slice(1).join(" ")
    if (feetStr) return `${feetStr}'${inchesStr}`
  }
  const digits = t.replace(/\D/g, "")
  if (digits === "") return ""
  if (digits.length === 1) return digits[0]
  const two = digits.slice(0, 2)
  const n = Number.parseInt(two, 10)
  if (n >= 10 && n <= 15) {
    const rest = digits.slice(2)
    return rest === "" ? `${two}'` : `${two}'${rest}`
  }
  const ft = digits.slice(0, 1)
  const rest = digits.slice(1)
  return rest === "" ? ft : `${ft}'${rest}`
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
