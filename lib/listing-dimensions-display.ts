import {
  formatDecimalDimension,
  parseBoardLengthParts,
  parseLengthFeet,
} from "@/lib/board-measurements"
import { parseListingDimensionsColumn } from "@/lib/listing-dimensions-storage"

function formatInchesForLength(inches: number): string {
  return formatDecimalDimension(inches) || "0"
}

/** Surfboard dimension columns on `listings` (numeric + optional display text). */
export type ListingDimensionsInput = {
  length_feet?: number | null
  length_inches?: number | null
  width?: number | null
  thickness?: number | null
  volume?: number | null
}

export type ListingDimensionsWithDisplay = ListingDimensionsInput & {
  /** Canonical surfboard dims string, e.g. `(5'11 18 3/8 2 1/4 27L)`. */
  dimensions?: string | null
  length_inches_display?: string | null
  width_inches_display?: string | null
  thickness_inches_display?: string | null
  volume_display?: string | null
}

/** Append inch mark if the seller did not already include " or ″ or "in". */
function appendInchMarkUnlessPresent(raw: string): string {
  const t = raw.trim()
  if (!t) return ""
  if (/["\u2033]$/u.test(t) || /\bin\s*$/i.test(t)) return t
  return `${t}\u2033`
}

function formatVolumeFromDisplay(raw: string): string {
  const t = raw.trim()
  if (!t) return ""
  const lower = t.toLowerCase()
  if (lower.endsWith("l") || lower.includes("litre") || lower.includes("liter")) return t
  return `${t} L`
}

function formatListingGeometryLineFromDimensionsColumn(dimensions: string): string | null {
  const parsed = parseListingDimensionsColumn(dimensions)
  if (!parsed) return null
  const parts: string[] = []
  const { feetStr, inchesStr } = parseBoardLengthParts(parsed.boardLength)
  const ft = parseLengthFeet(feetStr)
  if (ft != null && Number.isFinite(ft)) {
    const inchDisp = inchesStr.trim()
    if (inchDisp) {
      parts.push(`${ft}'${appendInchMarkUnlessPresent(inchDisp)}`)
    } else {
      parts.push(`${ft}'`)
    }
  }
  const w = appendInchMarkUnlessPresent(parsed.boardWidthInches)
  const t = appendInchMarkUnlessPresent(parsed.boardThicknessInches)
  if (w) parts.push(w)
  if (t) parts.push(t)
  return parts.length ? parts.join(" \u00d7 ") : null
}

function formatListingVolumePartFromDimensionsColumn(dimensions: string): string | null {
  const parsed = parseListingDimensionsColumn(dimensions)
  if (!parsed?.boardVolumeL?.trim()) return null
  return formatVolumeFromDisplay(parsed.boardVolumeL)
}

function listingDimensionLabeledRowsFromDimensionsColumn(
  dimensions: string,
): ListingDimensionLabeledRow[] {
  const parsed = parseListingDimensionsColumn(dimensions)
  if (!parsed) return []
  const rows: ListingDimensionLabeledRow[] = []
  const { feetStr, inchesStr } = parseBoardLengthParts(parsed.boardLength)
  const ft = parseLengthFeet(feetStr)
  if (ft != null && Number.isFinite(ft)) {
    const inchDisp = inchesStr.trim()
    if (inchDisp) {
      rows.push({ label: "Length", value: `${ft}'${appendInchMarkUnlessPresent(inchDisp)}` })
    } else {
      rows.push({ label: "Length", value: `${ft}'` })
    }
  }
  const w = appendInchMarkUnlessPresent(parsed.boardWidthInches)
  if (w) rows.push({ label: "Width", value: w })
  const t = appendInchMarkUnlessPresent(parsed.boardThicknessInches)
  if (t) rows.push({ label: "Thickness", value: t })
  const v = parsed.boardVolumeL?.trim()
  if (v) rows.push({ label: "Volume", value: formatVolumeFromDisplay(v) })
  return rows
}

/**
 * Short length line for cards (e.g. tiles): `5'9` plus inches as entered when stored.
 */
export function formatListingBoardLengthSubtitle(input: ListingDimensionsWithDisplay): string | null {
  const fromStored = input.dimensions?.trim() ? parseListingDimensionsColumn(input.dimensions) : null
  if (fromStored) {
    const { feetStr, inchesStr } = parseBoardLengthParts(fromStored.boardLength)
    const ft = parseLengthFeet(feetStr)
    if (ft == null || !Number.isFinite(ft)) return null
    const inchDisp = inchesStr.trim()
    if (inchDisp) {
      return `${ft}'${appendInchMarkUnlessPresent(inchDisp)}`
    }
    if (fromStored.boardLength.trim()) return fromStored.boardLength.trim()
    return `${ft}'`
  }

  const ft = input.length_feet
  const inchDisp = input.length_inches_display?.trim()
  const inchNum = input.length_inches
  if (ft == null || !Number.isFinite(ft)) return null
  if (inchDisp) {
    return `${ft}'${appendInchMarkUnlessPresent(inchDisp)}`
  }
  if (inchNum != null && Number.isFinite(inchNum) && inchNum > 0) {
    return `${ft}'${formatInchesForLength(inchNum)}\u2033`
  }
  return `${ft}'`
}

/**
 * Length × width × thickness only (× between). Omits volume.
 */
export function formatListingGeometryLine(input: ListingDimensionsWithDisplay): string | null {
  const dimStr = input.dimensions?.trim()
  if (dimStr) {
    const fromCol = formatListingGeometryLineFromDimensionsColumn(dimStr)
    if (fromCol) return fromCol
  }

  const parts: string[] = []
  const ft = input.length_feet
  const inchNum = input.length_inches
  const inchDisp = input.length_inches_display?.trim()

  if (ft != null && Number.isFinite(ft)) {
    if (inchDisp) {
      parts.push(`${ft}'${appendInchMarkUnlessPresent(inchDisp)}`)
    } else if (inchNum != null && Number.isFinite(inchNum) && inchNum > 0) {
      parts.push(`${ft}'${formatInchesForLength(inchNum)}\u2033`)
    } else {
      parts.push(`${ft}'`)
    }
  }

  const wDisp = input.width_inches_display?.trim()
  if (wDisp) {
    parts.push(appendInchMarkUnlessPresent(wDisp))
  } else if (input.width != null && Number.isFinite(input.width)) {
    parts.push(`${formatDecimalDimension(input.width)}\u2033`)
  }

  const tDisp = input.thickness_inches_display?.trim()
  if (tDisp) {
    parts.push(appendInchMarkUnlessPresent(tDisp))
  } else if (input.thickness != null && Number.isFinite(input.thickness)) {
    parts.push(`${formatDecimalDimension(input.thickness)}\u2033`)
  }

  if (parts.length === 0) return null
  return parts.join(" \u00d7 ")
}

/**
 * Volume segment only (liters), for display after geometry — not joined with ×.
 */
export function formatListingVolumePart(input: ListingDimensionsWithDisplay): string | null {
  const dimStr = input.dimensions?.trim()
  if (dimStr) {
    const fromCol = formatListingVolumePartFromDimensionsColumn(dimStr)
    if (fromCol) return fromCol
  }

  const vDisp = input.volume_display?.trim()
  if (vDisp) {
    return formatVolumeFromDisplay(vDisp)
  }
  if (input.volume != null && Number.isFinite(input.volume)) {
    return `${formatDecimalDimension(input.volume)} L`
  }
  return null
}

export type ListingDimensionLabeledRow = { label: string; value: string }

export function listingDimensionLabeledRows(input: ListingDimensionsWithDisplay): ListingDimensionLabeledRow[] {
  const dimStr = input.dimensions?.trim()
  if (dimStr) {
    const fromCol = listingDimensionLabeledRowsFromDimensionsColumn(dimStr)
    if (fromCol.length > 0) return fromCol
  }

  const rows: ListingDimensionLabeledRow[] = []
  const ft = input.length_feet
  const inchNum = input.length_inches
  const inchDisp = input.length_inches_display?.trim()
  if (ft != null && Number.isFinite(ft)) {
    if (inchDisp) {
      rows.push({ label: "Length", value: `${ft}'${appendInchMarkUnlessPresent(inchDisp)}` })
    } else if (inchNum != null && Number.isFinite(inchNum) && inchNum > 0) {
      rows.push({ label: "Length", value: `${ft}'${formatInchesForLength(inchNum)}\u2033` })
    } else {
      rows.push({ label: "Length", value: `${ft}'` })
    }
  }
  const wDisp = input.width_inches_display?.trim()
  if (wDisp) {
    rows.push({ label: "Width", value: appendInchMarkUnlessPresent(wDisp) })
  } else if (input.width != null && Number.isFinite(input.width)) {
    rows.push({ label: "Width", value: `${formatDecimalDimension(input.width)}\u2033` })
  }
  const tDisp = input.thickness_inches_display?.trim()
  if (tDisp) {
    rows.push({ label: "Thickness", value: appendInchMarkUnlessPresent(tDisp) })
  } else if (input.thickness != null && Number.isFinite(input.thickness)) {
    rows.push({ label: "Thickness", value: `${formatDecimalDimension(input.thickness)}\u2033` })
  }
  const vDisp = input.volume_display?.trim()
  if (vDisp) {
    rows.push({ label: "Volume", value: formatVolumeFromDisplay(vDisp) })
  } else if (input.volume != null && Number.isFinite(input.volume)) {
    rows.push({ label: "Volume", value: `${formatDecimalDimension(input.volume)} L` })
  }
  return rows
}

/**
 * Full line with geometry and volume separated by middle dot (not ×).
 */
export function formatListingDimensionsLine(input: ListingDimensionsWithDisplay): string | null {
  const g = formatListingGeometryLine(input)
  const v = formatListingVolumePart(input)
  if (g && v) return `${g} \u00b7 ${v}`
  return g ?? v
}

const LEGACY_LISTING_DIMENSION_DB_KEYS = [
  "length_feet",
  "length_inches",
  "width",
  "thickness",
  "volume",
  "length_inches_display",
  "width_inches_display",
  "thickness_inches_display",
  "volume_display",
] as const

const LISTING_SCHEMA_CACHE_OPTIONAL_KEYS = [
  ...LEGACY_LISTING_DIMENSION_DB_KEYS,
  "fins_included",
] as const

/** Drop listing columns that may lag schema cache / migrations (retry insert/update). */
export function withoutListingDimensionDisplayDbFields(
  row: Record<string, unknown>,
): Record<string, unknown> {
  const out = { ...row }
  for (const k of LISTING_SCHEMA_CACHE_OPTIONAL_KEYS) {
    delete out[k]
  }
  return out
}

function errorBlobForSchemaCheck(error: unknown): string {
  if (error instanceof Error) return error.message
  if (error && typeof error === "object") {
    const o = error as { message?: unknown; details?: unknown; hint?: unknown; code?: unknown }
    return [o.message, o.details, o.hint, o.code]
      .filter((x): x is string => typeof x === "string" && x.trim() !== "")
      .join(" ")
  }
  return ""
}

/**
 * PostgREST when `listings` is missing migrated columns (schema cache / PGRST204).
 */
export function isListingDimensionDisplaySchemaCacheError(error: unknown): boolean {
  const text = errorBlobForSchemaCheck(error)
  const lower = text.toLowerCase()
  const mentionsLegacy = LISTING_SCHEMA_CACHE_OPTIONAL_KEYS.some((k) => lower.includes(k))
  if (!mentionsLegacy) return false
  return lower.includes("schema cache") || lower.includes("pgrst204") || lower.includes("does not exist")
}
