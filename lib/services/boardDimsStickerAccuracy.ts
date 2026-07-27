import {
  isBoardLengthEntryComplete,
  isTapeStyleInchesEntryComplete,
  isVolumeLitersEntryComplete,
  normalizeBoardLengthInput,
  normalizeTapeStyleInchesInput,
  normalizeVolumeLitersInput,
  parseBoardLengthParts,
  parseBoardMeasurement,
  parseLengthFeet,
  parseVolumeLiters,
} from "@/lib/board-measurements"

export type ParsedStickerDims = {
  length: string | null
  widthInches: string | null
  thicknessInches: string | null
  volumeL: string | null
}

function stripDimJunk(s: string): string {
  return s
    .replace(/[″”]/g, '"')
    .replace(/[′’]/g, "'")
    .replace(/\s+/g, " ")
    .trim()
}

function compactDimToken(s: string): string {
  return stripDimJunk(s)
    .toLowerCase()
    .replace(/["\s]+/g, "")
}

function normalizeLengthToken(raw: string): string | null {
  let t = stripDimJunk(raw).replace(/\s*[Ll]\s*$/, "")
  t = t.replace(/["″”]/g, "")
  if (!t.includes("'")) {
    const spaced = t.match(/^(\d{1,2})\s+(\d{1,2}(?:\s+\d+\/\d+)?|\d+\/\d+)$/)
    if (spaced) t = `${spaced[1]}'${spaced[2]}`
  }
  const normalized = normalizeBoardLengthInput(t)
  if (!isBoardLengthEntryComplete(normalized)) return null
  const { feetStr, inchesStr } = parseBoardLengthParts(normalized)
  const ft = parseLengthFeet(feetStr)
  if (ft == null || ft < 1 || ft > 15) return null
  const inches =
    parseBoardMeasurement(inchesStr.trim()) ?? Number.parseFloat(inchesStr.trim())
  if (!Number.isFinite(inches) || inches < 0 || inches >= 12) return null
  return normalized
}

function normalizeInchesToken(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  let t = stripDimJunk(raw).replace(/["″”]/g, "").replace(/\s*in(?:ches)?\.?$/i, "")
  if (/^\d+,\d+$/.test(t)) t = t.replace(",", ".")
  t = normalizeTapeStyleInchesInput(t)
  if (!isTapeStyleInchesEntryComplete(t)) return null
  const v = parseBoardMeasurement(t) ?? Number.parseFloat(t)
  if (!Number.isFinite(v) || v <= 0 || v > 40) return null
  if (t.includes("/")) return t.trim()
  if (/^\d+\.\d+$/.test(t.trim())) return String(Number.parseFloat(t.trim()))
  return t.trim()
}

function normalizeVolumeToken(raw: string | null | undefined): string | null {
  if (!raw?.trim()) return null
  let t = stripDimJunk(raw).replace(/\s*[Ll]\s*$/, "")
  t = normalizeVolumeLitersInput(t)
  if (!isVolumeLitersEntryComplete(t)) return null
  const v = parseVolumeLiters(t)
  if (v == null || v < 5 || v > 200) return null
  return t.trim()
}

/**
 * Deterministic parse of a sticker dimension line, e.g.
 * `6'4" 19 3/8" 2 5/8" 38.4L` → length / width / thickness / volume.
 * Order assumes classic L → W → T → Vol layout.
 */
export function parseBoardDimsFromStickerText(rawText: string): ParsedStickerDims {
  const empty: ParsedStickerDims = {
    length: null,
    widthInches: null,
    thicknessInches: null,
    volumeL: null,
  }
  const text = stripDimJunk(rawText)
  if (!text) return empty

  let rest = text

  const lengthMatch = rest.match(/(\d{1,2})\s*'\s*(\d{1,2}(?:\s+\d+\/\d+)?)/)
  const length = lengthMatch
    ? normalizeLengthToken(`${lengthMatch[1]}'${lengthMatch[2]}`)
    : null
  if (lengthMatch) rest = rest.replace(lengthMatch[0], " ")

  const volumeMatch =
    rest.match(/\b(\d{1,3}(?:\.\d+)?)\s*[Ll]\b/) ??
    rest.match(/\b(\d{2,3}\.\d)\b/)
  const volumeL = volumeMatch ? normalizeVolumeToken(volumeMatch[1]!) : null
  if (volumeMatch) rest = rest.replace(volumeMatch[0], " ")

  const inchMatches = [
    ...rest.matchAll(/\b(\d{1,2}\s+\d+\/\d+|\d{1,2}\.\d{1,4})\b/g),
  ].map((m) => m[1]!)

  const widthInches = inchMatches[0] ? normalizeInchesToken(inchMatches[0]) : null
  const thicknessInches = inchMatches[1] ? normalizeInchesToken(inchMatches[1]) : null

  return { length, widthInches, thicknessInches, volumeL }
}

/** True when the field's written form appears in the sticker transcript. */
export function dimTokenAppearsInRawText(fieldValue: string, rawText: string): boolean {
  const needle = compactDimToken(fieldValue)
  if (!needle) return false
  return compactDimToken(rawText).includes(needle)
}

function valuesEquivalent(a: string, b: string): boolean {
  const pa = parseBoardMeasurement(a) ?? parseVolumeLiters(a) ?? Number.parseFloat(a)
  const pb = parseBoardMeasurement(b) ?? parseVolumeLiters(b) ?? Number.parseFloat(b)
  if (Number.isFinite(pa) && Number.isFinite(pb)) {
    return Math.abs((pa as number) - (pb as number)) < 0.001
  }
  return compactDimToken(a) === compactDimToken(b)
}

/**
 * Accuracy-first reconcile: sticker transcript wins. Structured fields are kept
 * only when they appear in rawText (or match the transcript parse). No rawText →
 * no auto-filled dims (blank is better than wrong).
 */
export function reconcileDimsForAccuracy(input: {
  rawText: string | undefined
  structured: ParsedStickerDims
}): ParsedStickerDims {
  const fromText = input.rawText?.trim()
    ? parseBoardDimsFromStickerText(input.rawText)
    : {
        length: null,
        widthInches: null,
        thicknessInches: null,
        volumeL: null,
      }

  const pick = (
    textVal: string | null,
    structuredVal: string | null,
  ): string | null => {
    if (textVal) {
      // If structured disagrees with transcript parse, trust transcript.
      if (
        structuredVal &&
        !valuesEquivalent(textVal, structuredVal) &&
        input.rawText &&
        !dimTokenAppearsInRawText(structuredVal, input.rawText)
      ) {
        return textVal
      }
      return textVal
    }
    if (!structuredVal) return null
    if (!input.rawText?.trim()) return null
    if (!dimTokenAppearsInRawText(structuredVal, input.rawText)) return null
    return structuredVal
  }

  return {
    length: pick(fromText.length, input.structured.length),
    widthInches: pick(fromText.widthInches, input.structured.widthInches),
    thicknessInches: pick(fromText.thicknessInches, input.structured.thicknessInches),
    volumeL: pick(fromText.volumeL, input.structured.volumeL),
  }
}

export {
  normalizeLengthToken as normalizeLengthForAccuracy,
  normalizeInchesToken as normalizeInchesForAccuracy,
  normalizeVolumeToken as normalizeVolumeForAccuracy,
}
