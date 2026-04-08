import { formatDecimalDimension } from "@/lib/board-measurements"

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

/**
 * Length × width × thickness only (× between). Omits volume.
 */
export function formatListingGeometryLine(input: ListingDimensionsWithDisplay): string | null {
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
