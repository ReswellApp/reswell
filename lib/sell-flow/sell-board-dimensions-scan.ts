import {
  canonicalBoardLengthFilterToken,
  normalizeBoardLengthInput,
  parseBoardLengthParts,
  parseBoardMeasurement,
  parseLengthFeet,
  parseVolumeLiters,
} from "../board-measurements.ts"

export type SellBoardDimensionsScanFields = {
  boardLength: string
  boardWidthInches: string
  boardThicknessInches: string
  boardVolumeL: string
  /** Stamp text the model could read, for the seller to compare. */
  rawText: string
  /** How the numbers were interpreted before they were written into the form. */
  formatLabel: string
}

const EMPTY = new Set(["null", "unknown", "n/a", "none", "unreadable", "-"])
const VOLUME_RE = /(\d+(?:[.,]\d+)?)\s*(?:l|lit(?:er|re)s?)\b/i

type Unit = "in" | "cm" | "mm"

function asText(value: unknown, max: number, preserveLines = false): string {
  const text = typeof value === "number" && Number.isFinite(value) ? String(value) : value
  if (typeof text !== "string") return ""
  const trimmed = (
    preserveLines ? text.replace(/[^\S\n]+/g, " ").replace(/\n{2,}/g, "\n") : text.replace(/\s+/g, " ")
  ).trim()
  if (!trimmed || EMPTY.has(trimmed.toLowerCase())) return ""
  return trimmed.slice(0, max)
}

function looksImperial(text: string): boolean {
  return /\d\s*['′]/.test(text) || /["″]/.test(text)
}

/** `5'10" / 178cm` keeps the inch side. A fraction slash (`19 1/4`) is not a separator. */
function preferImperialSegment(text: string): string {
  const parts = text.split(/\s+\|\s+|\s+\/\s+|(?<=["″])\s*\/\s*/)
  if (parts.length < 2) return text
  const imperial = parts.find((part) => looksImperial(part))
  return imperial ?? text
}

function peelVolume(text: string): { text: string; volume: string } {
  const match = text.match(VOLUME_RE)
  return {
    text: text.replace(VOLUME_RE, " ").replace(/[^\S\n]+/g, " ").trim(),
    volume: match?.[1]?.replace(",", ".") ?? "",
  }
}

function measurementNumber(raw: string): number | null {
  let text = preferImperialSegment(raw)
  text = peelVolume(text).text
  text = text.replace(/\b(centimeters|centimeter|millimeters|millimeter|inches|inch|cm|mm|in)\b\.?/gi, " ")
  text = text.replace(/[″”"]/g, "").replace(/\s+/g, " ").trim()
  if (!text || text.includes("'") || text.includes("′")) return null
  const direct = parseBoardMeasurement(text)
  if (direct != null) return direct
  const match = text.match(/(\d+\s+\d+\/\d+|\d+\/\d+|\d+(?:[.,]\d+)?)/)
  if (!match) return null
  return parseBoardMeasurement(match[1].replace(",", "."))
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

/** Snap to the sell-form grid and store the fraction the picker already uses (`19 1/4`). */
function formatSnappedInches(inches: number, step: number): string {
  const steps = Math.round(inches / step)
  const sixteenths = Math.round(steps * step * 16)
  if (sixteenths <= 0) return ""
  const whole = Math.floor(sixteenths / 16)
  const frac = sixteenths - whole * 16
  if (frac === 0) return String(whole)
  const divisor = gcd(frac, 16)
  const numerator = frac / divisor
  const denominator = 16 / divisor
  if (whole === 0) return `${numerator}/${denominator}`
  return `${whole} ${numerator}/${denominator}`
}

function lengthFromTotalInches(totalInches: number): string {
  const rounded = Math.round(totalInches)
  if (rounded < 48 || rounded > 144) return ""
  const feet = Math.floor(rounded / 12)
  const inches = rounded % 12
  if (feet < 4 || feet > 12) return ""
  if (feet === 12 && inches !== 0) return ""
  return `${feet}'${inches}`
}

function imperialLength(raw: string): string {
  const segment = peelVolume(preferImperialSegment(raw)).text
  const normalized = normalizeBoardLengthInput(segment).replace(/["″]+/g, "").trim()
  const token = canonicalBoardLengthFilterToken(normalized)
  if (token) {
    const { feetStr, inchesStr } = parseBoardLengthParts(token)
    const feet = parseLengthFeet(feetStr)
    const inches = parseBoardMeasurement(inchesStr.trim())
    if (feet != null && inches != null) return lengthFromTotalInches(feet * 12 + inches)
  }
  const bare = measurementNumber(segment)
  if (bare != null && bare >= 36 && bare <= 144) return lengthFromTotalInches(bare)
  return ""
}

function statedUnit(raw: string): Unit | null {
  const token = raw.trim().toLowerCase()
  if (token === "in" || token === "inch" || token === "inches") return "in"
  if (token === "cm" || token === "centimeter" || token === "centimeters") return "cm"
  if (token === "mm" || token === "millimeter" || token === "millimeters") return "mm"
  return null
}

function resolveUnit(stated: string, lengthText: string, rawText: string): Unit {
  const explicit = statedUnit(stated)
  if (looksImperial(lengthText) || looksImperial(rawText)) return "in"
  if (explicit) {
    if (explicit !== "in") return explicit
    const n = measurementNumber(lengthText)
    if (n != null && n >= 1400 && n <= 4500) return "mm"
    if (n != null && n >= 140 && n <= 450) return "cm"
    return "in"
  }
  const blob = `${lengthText} ${rawText}`
  const n = measurementNumber(lengthText)
  if (n != null && n >= 1400 && n <= 4500) return "mm"
  if (n != null && n >= 140 && n <= 450) return "cm"
  if (/\bmm\b/i.test(blob)) return "mm"
  if (/\bcm\b/i.test(blob)) return "cm"
  return "in"
}

function toInches(raw: string, unit: Unit, step: number, min: number, max: number): string {
  if (unit === "in") {
    const cleaned = peelVolume(preferImperialSegment(raw))
      .text.replace(/\b(inches|inch|in)\b\.?/gi, "")
      .replace(/[″”"]/g, "")
      .replace(/\s+/g, " ")
      .trim()
    const n = parseBoardMeasurement(cleaned) ?? measurementNumber(cleaned)
    if (n == null || n < min || n > max) return ""
    return formatSnappedInches(n, step)
  }
  const n = measurementNumber(raw)
  if (n == null) return ""
  const inches = unit === "cm" ? n / 2.54 : n / 25.4
  if (inches < min || inches > max) return ""
  return formatSnappedInches(inches, step)
}

function toVolume(raw: string): string {
  const peeled = peelVolume(raw).volume || raw
  const liters = parseVolumeLiters(peeled)
  if (liters == null || liters < 8 || liters > 150) return ""
  const rounded = Math.round(liters * 100) / 100
  return Number.isInteger(rounded) ? String(rounded) : String(rounded)
}

function splitStamp(raw: string): [string, string, string] | null {
  const parts = peelVolume(raw)
    .text.split(/\s*[x×]\s*|\s*\n+\s*/)
    .map((part) => part.trim())
    .filter((part) => /\d/.test(part))
  if (parts.length < 3) return null
  return [parts[0], parts[1], parts[2]]
}

function metricLength(raw: string, unit: Exclude<Unit, "in">): string {
  const n = measurementNumber(raw)
  if (n == null) return ""
  return lengthFromTotalInches(n / (unit === "cm" ? 2.54 : 25.4))
}

function formatLabelFor(unit: Unit): string {
  if (unit === "cm") return "Centimeters, converted to feet and inches"
  if (unit === "mm") return "Millimeters, converted to feet and inches"
  return "Length × width × thickness, in inches"
}

/**
 * Turn a vision read of a surfboard size stamp into sell-form dimension fields.
 * Unreadable or implausible numbers are left blank. Returns null when nothing usable remains.
 */
export function boardDimensionsFromScan(input: {
  lengthText?: unknown
  widthText?: unknown
  thicknessText?: unknown
  volumeText?: unknown
  unit?: unknown
  rawText?: unknown
}): SellBoardDimensionsScanFields | null {
  const rawText = asText(input.rawText, 160, true)
  let lengthText = asText(input.lengthText, 40)
  let widthText = asText(input.widthText, 40)
  let thicknessText = asText(input.thicknessText, 40)
  let volumeText = asText(input.volumeText, 24)

  if (!lengthText && !widthText && !thicknessText) {
    const split = splitStamp(rawText)
    if (split) [lengthText, widthText, thicknessText] = split
  }
  if (!volumeText) {
    volumeText = peelVolume(rawText).volume || peelVolume(`${lengthText} ${widthText} ${thicknessText}`).volume
  }

  const unit = resolveUnit(asText(input.unit, 20), lengthText, rawText)
  const fields: SellBoardDimensionsScanFields = {
    boardLength: unit === "in" ? imperialLength(lengthText) : metricLength(lengthText, unit),
    boardWidthInches: toInches(widthText, unit, 1 / 8, 10, 30),
    boardThicknessInches: toInches(thicknessText, unit, 1 / 16, 0.75, 6),
    boardVolumeL: toVolume(volumeText),
    rawText,
    formatLabel: formatLabelFor(unit),
  }
  if (
    !fields.boardLength &&
    !fields.boardWidthInches &&
    !fields.boardThicknessInches &&
    !fields.boardVolumeL
  ) {
    return null
  }
  return fields
}
