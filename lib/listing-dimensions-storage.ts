/**
 * Surfboard dims on `listings.dimensions` (`text`):
 * - **Full tuple:** canonical `(length width thickness volumeL)` e.g. `(5'11 18 3/8 2 1/4 32L)`.
 * - **Partial (from /sell when fewer than four fields validate):**
 *   `{"v":2,"L"?:…,"W"?:…,"T"?:…,"V"?:…}` (short keys).
 */

import {
  formatBoardLengthForTitle,
  formatBoardLengthInputFromParts,
  formatDecimalDimension,
  normalizeBoardLengthInput,
  normalizeTapeStyleInchesInput,
  normalizeVolumeLitersInput,
  parseBoardLengthParts,
  parseBoardMeasurement,
  parseLengthFeet,
  parseVolumeLiters,
  isTapeStyleInchesEntryComplete,
} from "@/lib/board-measurements"
import {
  resolveLengthTotalInches,
  resolveVolumeLiters,
} from "@/lib/listing-browse-facet-measurements"

const MAX_DIMENSIONS_COLUMN_LEN = 512

export function listingDimensionsColumnTrim(raw: unknown): string | null {
  if (raw == null) return null
  const s = String(raw).trim().slice(0, MAX_DIMENSIONS_COLUMN_LEN)
  return s === "" ? null : s
}

function volumeStorageToken(boardVolumeL: string): string | null {
  const v0 = normalizeVolumeLitersInput(boardVolumeL).trim()
  if (!v0) return null
  const n = parseVolumeLiters(v0)
  const core =
    n != null
      ? Number.isInteger(n)
        ? String(Math.trunc(n))
        : formatDecimalDimension(n)
      : v0.replace(/\s*[lL]\s*$/u, "").trim()
  if (!core) return null
  return `${core}L`
}

/**
 * Normalizes combined length (`6`, `62`, `6'2`) into stored form `{feet}'{inches?}` so
 * {@link parseListingDimensionsColumn} can tell feet apart from inch groups (requires `'`).
 * Mirrors surfboard sell validation inch rules (whole feet 1–15, inch segment under 12).
 */
function canonicalBoardLengthForDimensionsColumn(normalizedCombined: string): string | null {
  const t = normalizedCombined.trim()
  if (!t) return null
  const { feetStr, inchesStr } = parseBoardLengthParts(t)
  if (!feetStr.trim()) return null
  const ft = parseLengthFeet(feetStr)
  if (ft == null || ft < 1 || ft > 15) return null
  const inRaw = inchesStr.trim() === "" ? "0" : inchesStr.trim()
  const inches = parseBoardMeasurement(inRaw) ?? Number.parseFloat(inRaw)
  if (!Number.isFinite(inches) || inches < 0 || inches >= 12) return null
  if (inchesStr.trim() === "") {
    return `${feetStr}'`
  }
  return `${feetStr}'${inchesStr}`
}

/**
 * Builds the value persisted on `listings.dimensions` from the sell form fields.
 */
export function composeListingDimensionsColumn(input: {
  boardLength: string
  boardWidthInches: string
  boardThicknessInches: string
  boardVolumeL: string
}): string | null {
  const lenNorm = normalizeBoardLengthInput(input.boardLength).trim()
  const len = canonicalBoardLengthForDimensionsColumn(lenNorm)
  const w = normalizeTapeStyleInchesInput(input.boardWidthInches).trim()
  const t = normalizeTapeStyleInchesInput(input.boardThicknessInches).trim()
  const vol = volumeStorageToken(input.boardVolumeL)
  if (!len || !w || !t || !vol) return null
  const inner = `${len} ${w} ${t} ${vol}`.trim()
  const out = `(${inner})`
  return out.length > MAX_DIMENSIONS_COLUMN_LEN ? out.slice(0, MAX_DIMENSIONS_COLUMN_LEN) : out
}

/** JSON envelope when fewer than four sell-form dimension fields validate (sell still allows publishes). */
const DIMENSIONS_PARTIAL_JSON_VERSION = 2 as const

type DimensionsPartialPersist = {
  v: typeof DIMENSIONS_PARTIAL_JSON_VERSION
  L?: string
  W?: string
  T?: string
  V?: string
}

function positiveTapeDisplayFromInput(raw: string): string | null {
  const t = normalizeTapeStyleInchesInput(raw).trim()
  if (!t) return null
  const n = parseBoardMeasurement(t) ?? Number.parseFloat(t)
  if (!Number.isFinite(n) || n <= 0) return null
  return t
}

/** Valid partial length segment only when it canonicalizes like the full compositor. */
function partialLengthCanonOrNull(normalizedCombined: string): string | null {
  const lenNorm = normalizedCombined.trim()
  return lenNorm ? canonicalBoardLengthForDimensionsColumn(lenNorm) : null
}

function volumeDisplayForPartialPersist(rawVol: string): string | null {
  const v0 = normalizeVolumeLitersInput(rawVol).trim()
  if (!v0) return null
  return parseVolumeLiters(v0) != null ? v0 : null
}

function buildListingDimensionsPartialJsonEnvelope(input: {
  boardLength: string
  boardWidthInches: string
  boardThicknessInches: string
  boardVolumeL: string
}): string | null {
  const payload: DimensionsPartialPersist = { v: DIMENSIONS_PARTIAL_JSON_VERSION }
  const L = partialLengthCanonOrNull(normalizeBoardLengthInput(input.boardLength))
  if (L) payload.L = L
  const W = positiveTapeDisplayFromInput(input.boardWidthInches)
  if (W) payload.W = W
  const T = positiveTapeDisplayFromInput(input.boardThicknessInches)
  if (T) payload.T = T
  const V = volumeDisplayForPartialPersist(input.boardVolumeL)
  if (V) payload.V = V
  const hasAnyExtra = !!(payload.L || payload.W || payload.T || payload.V)
  if (!hasAnyExtra) return null
  const json = JSON.stringify(payload)
  return json.length > MAX_DIMENSIONS_COLUMN_LEN ? json.slice(0, MAX_DIMENSIONS_COLUMN_LEN) : json
}

/**
 * Surfaces the surfboard sell form as `listings.dimensions` (Postgres `text`).
 * Fully specified rows use the canonical parenthetical `(L W T VL)` form; incomplete rows use
 * `{"v":2,"L"?:…,"W"?:…,"T"?:…,"V"?:…}` so single-field publishes still persist something useful.
 */
export function listingDimensionsColumnFromSurfboardSellForm(input: {
  boardLength: string
  boardWidthInches: string
  boardThicknessInches: string
  boardVolumeL: string
}): string | null {
  const canonical = composeListingDimensionsColumn(input)
  if (canonical) return listingDimensionsColumnTrim(canonical)
  const partialJson = buildListingDimensionsPartialJsonEnvelope(input)
  return listingDimensionsColumnTrim(partialJson)
}

/** Builds `dimensions` from API/admin payloads that still send split numeric + display fields. */
export function composeListingDimensionsFromSplitListingFields(row: {
  length_feet?: unknown
  length_inches?: unknown
  length_inches_display?: unknown
  width?: unknown
  width_inches_display?: unknown
  thickness?: unknown
  thickness_inches_display?: unknown
  volume?: unknown
  volume_display?: unknown
}): string | null {
  const feet =
    row.length_feet != null && row.length_feet !== "" ? String(row.length_feet).replace(/\D/g, "") : ""
  const inchDispRaw =
    typeof row.length_inches_display === "string" && row.length_inches_display.trim()
      ? row.length_inches_display.trim()
      : row.length_inches != null && row.length_inches !== ""
        ? String(row.length_inches)
        : ""
  const boardLength = formatBoardLengthInputFromParts(feet, inchDispRaw)
  const w =
    (typeof row.width_inches_display === "string" && row.width_inches_display.trim()) ||
    (row.width != null && row.width !== "" ? String(row.width) : "")
  const t =
    (typeof row.thickness_inches_display === "string" && row.thickness_inches_display.trim()) ||
    (row.thickness != null && row.thickness !== "" ? String(row.thickness) : "")
  const v =
    (typeof row.volume_display === "string" && row.volume_display.trim()) ||
    (row.volume != null && row.volume !== "" ? String(row.volume) : "")
  return listingDimensionsColumnFromSurfboardSellForm({
    boardLength,
    boardWidthInches: w,
    boardThicknessInches: t,
    boardVolumeL: v,
  })
}

function parseListingDimensionsPartialJsonEnvelope(trimmedJson: string): {
  boardLength: string
  boardWidthInches: string
  boardThicknessInches: string
  boardVolumeL: string
} | null {
  let o: unknown
  try {
    o = JSON.parse(trimmedJson)
  } catch {
    return null
  }
  if (!o || typeof o !== "object") return null
  const rec = o as Record<string, unknown>
  if (rec.v !== DIMENSIONS_PARTIAL_JSON_VERSION) return null
  const boardLength =
    typeof rec.L === "string" && rec.L.trim() ? normalizeBoardLengthInput(rec.L) : ""
  const boardWidthInches =
    typeof rec.W === "string" ? normalizeTapeStyleInchesInput(rec.W) : ""
  const boardThicknessInches =
    typeof rec.T === "string" ? normalizeTapeStyleInchesInput(rec.T) : ""
  const boardVolumeL =
    typeof rec.V === "string" ? normalizeVolumeLitersInput(rec.V) : ""
  const any =
    boardLength.trim() ||
    boardWidthInches.trim() ||
    boardThicknessInches.trim() ||
    boardVolumeL.trim()
  if (!any) return null
  return {
    boardLength,
    boardWidthInches,
    boardThicknessInches,
    boardVolumeL,
  }
}

function popInchesGroup(tokens: string[]): string {
  if (!tokens.length) return ""
  let acc = tokens.pop()!
  while (tokens.length > 0) {
    const next = tokens[tokens.length - 1]
    if (next.includes("'")) break
    const candidate = `${next} ${acc}`
    if (parseBoardMeasurement(candidate) != null) {
      acc = candidate
      tokens.pop()
    } else {
      break
    }
  }
  return acc
}

/** Peels last `n` tokens as volume (must end with L); mutates `tokens`. */
function tryPeelVolumeSuffix(tokens: string[], n: number): string | null {
  if (n < 1 || n > tokens.length) return null
  const slice = tokens.slice(-n).join(" ")
  if (!/[lL]\s*$/.test(slice)) return null
  const volRaw = slice.replace(/\s*L\s*$/iu, "").trim()
  if (parseVolumeLiters(volRaw) == null) return null
  tokens.splice(tokens.length - n, n)
  return volRaw
}

/**
 * Rehydrates sell-form fields from `listings.dimensions`.
 */
export function parseListingDimensionsColumn(raw: string | null | undefined): {
  boardLength: string
  boardWidthInches: string
  boardThicknessInches: string
  boardVolumeL: string
} | null {
  if (!raw?.trim()) return null
  const trimmed = raw.trim()

  const fromJson = parseListingDimensionsPartialJsonEnvelope(trimmed)
  if (fromJson) return fromJson

  let s = trimmed
  if (s.startsWith("(") && s.endsWith(")")) s = s.slice(1, -1).trim()

  const allTokens = s.split(/\s+/u).filter(Boolean)
  if (allTokens.length < 4) return null

  const nMax = Math.min(4, allTokens.length - 3)
  for (let n = 1; n <= nMax; n++) {
    const work = [...allTokens]
    const volRaw = tryPeelVolumeSuffix(work, n)
    if (volRaw == null || work.length < 3) continue

    const w = [...work]
    const thick = popInchesGroup(w)
    const width = popInchesGroup(w)
    let length = w.join(" ").trim()
    if (!length.includes("'")) {
      const repaired = canonicalBoardLengthForDimensionsColumn(length)
      if (!repaired) continue
      length = repaired
    }
    if (
      !isTapeStyleInchesEntryComplete(width) ||
      !isTapeStyleInchesEntryComplete(thick)
    ) {
      continue
    }
    const { feetStr, inchesStr } = parseBoardLengthParts(length)
    if (!parseLengthFeet(feetStr)) continue
    const inchRaw = inchesStr.trim() === "" ? "0" : inchesStr.trim()
    let inchesNum: number | null = null
    if (/\s/u.test(inchRaw) || inchRaw.includes("/")) {
      inchesNum = parseBoardMeasurement(inchRaw)
      if (inchesNum == null) continue
    } else {
      inchesNum = parseBoardMeasurement(inchRaw) ?? Number.parseFloat(inchRaw)
    }
    if (!Number.isFinite(inchesNum) || inchesNum < 0 || inchesNum >= 12) continue

    return {
      boardLength: normalizeBoardLengthInput(length),
      boardWidthInches: normalizeTapeStyleInchesInput(width),
      boardThicknessInches: normalizeTapeStyleInchesInput(thick),
      boardVolumeL: normalizeVolumeLitersInput(volRaw),
    }
  }

  return null
}

/** Rehydrate surfboard sell-form dimension fields from persisted listing columns. */
export function surfboardSellFormDimensionsFromListingRow(row: {
  dimensions?: string | null
  length_total_inches?: number | null
  volume_liters?: number | null
  title?: string | null
}): {
  boardLength: string
  boardWidthInches: string
  boardThicknessInches: string
  boardVolumeL: string
} {
  const fromColumn = row.dimensions?.trim() ? parseListingDimensionsColumn(row.dimensions) : null
  if (fromColumn) return fromColumn

  const boardLength = (() => {
    const total = resolveLengthTotalInches(row)
    if (total == null) return ""
    const ft = Math.floor(total / 12)
    const inches = total - ft * 12
    const inchStr =
      inches === 0 ? "0" : formatDecimalDimension(inches) || String(inches)
    return formatBoardLengthInputFromParts(String(ft), inchStr)
  })()

  const boardVolumeL = (() => {
    const vol = resolveVolumeLiters(row)
    if (vol == null) return ""
    return formatDecimalDimension(vol) || String(vol)
  })()

  return {
    boardLength,
    boardWidthInches: "",
    boardThicknessInches: "",
    boardVolumeL,
  }
}

/** Card / tile subtitle: canonical length label from `dimensions` only. */
export function boardLengthLabelFromDimensionsColumn(
  dimensions: string | null | undefined,
): string | null {
  const parsed = dimensions?.trim() ? parseListingDimensionsColumn(dimensions) : null
  if (!parsed) return null
  const label = formatBoardLengthForTitle(parsed.boardLength).trim()
  return label === "" ? null : label
}
