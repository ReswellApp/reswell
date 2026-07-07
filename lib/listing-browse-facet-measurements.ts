/**
 * Resolve surfboard length/volume for browse filters from every persisted source on `listings`.
 * Facet counts, Elasticsearch docs, and SQL backfills should all use these helpers so the UI
 * matches what sellers entered (split columns, dimensions text, or title tokens like `5'7`).
 */

import {
  formatBoardLengthInputFromParts,
  parseVolumeLiters,
  totalBoardLengthInchesFromCombinedInput,
} from "@/lib/board-measurements"
import { parseListingDimensionsColumn } from "@/lib/listing-dimensions-storage"

export type ListingBrowseFacetMeasurementRow = {
  length_total_inches?: number | null
  volume_liters?: number | null
  dimensions?: string | null
  length_feet?: number | null
  length_inches?: number | null
  length_inches_display?: string | null
  volume?: number | null
  volume_display?: string | null
  title?: string | null
}

function finitePositive(n: number | null | undefined): number | null {
  if (n == null || !Number.isFinite(Number(n))) return null
  const v = Number(n)
  return v > 0 ? v : null
}

function lengthFromSplitColumns(row: ListingBrowseFacetMeasurementRow): number | null {
  const ft = row.length_feet
  if (ft == null || !Number.isFinite(Number(ft))) return null
  const ftNum = Math.trunc(Number(ft))
  if (ftNum < 1 || ftNum > 15) return null

  const inchDisp =
    (typeof row.length_inches_display === "string" && row.length_inches_display.trim()) ||
    (row.length_inches != null && Number.isFinite(Number(row.length_inches))
      ? String(row.length_inches)
      : "0")

  const combined = formatBoardLengthInputFromParts(String(ftNum), inchDisp)
  return totalBoardLengthInchesFromCombinedInput(combined)
}

/** First surfboard length token in a listing title (`5'7`, `5'10"`, `6'1`, …). */
export function lengthTotalInchesFromListingTitle(title: string | null | undefined): number | null {
  if (!title?.trim()) return null
  const t = title.trim()
  const patterns = [
    /^(\d{1,2})['′]\s*(\d{1,2}(?:\s*\d+\/\d+)?)?(?:"|\u2033|\b)/u,
    /(?:^|\s)(\d{1,2})['′]\s*(\d{1,2}(?:\s*\d+\/\d+)?)?(?:"|\u2033|\b)/u,
  ]
  for (const re of patterns) {
    const m = t.match(re)
    if (!m) continue
    const combined = m[2] != null && m[2] !== "" ? `${m[1]}'${m[2]}` : `${m[1]}'`
    const total = totalBoardLengthInchesFromCombinedInput(combined)
    if (total != null) return total
  }
  return null
}

function volumeFromSplitColumns(row: ListingBrowseFacetMeasurementRow): number | null {
  const fromDisplay = row.volume_display?.trim()
    ? parseVolumeLiters(row.volume_display)
    : null
  if (fromDisplay != null) return fromDisplay
  const stored = finitePositive(row.volume)
  return stored
}

function volumeFromTitle(title: string | null | undefined): number | null {
  if (!title?.trim()) return null
  const m = title.match(/(\d+(?:\.\d+)?)\s*[lL]\b/u)
  return m ? parseVolumeLiters(m[1]) : null
}

/** Overall board length in inches for browse length buckets. */
export function resolveLengthTotalInches(row: ListingBrowseFacetMeasurementRow): number | null {
  const stored = finitePositive(row.length_total_inches)
  if (stored != null) return stored

  const fromSplit = lengthFromSplitColumns(row)
  if (fromSplit != null) return fromSplit

  const parsed = row.dimensions?.trim() ? parseListingDimensionsColumn(row.dimensions) : null
  if (parsed?.boardLength.trim()) {
    const fromDimensions = totalBoardLengthInchesFromCombinedInput(parsed.boardLength)
    if (fromDimensions != null) return fromDimensions
  }

  return lengthTotalInchesFromListingTitle(row.title)
}

/** Board volume in liters for browse volume buckets. */
export function resolveVolumeLiters(row: ListingBrowseFacetMeasurementRow): number | null {
  const stored = finitePositive(row.volume_liters)
  if (stored != null) return stored

  const fromSplit = volumeFromSplitColumns(row)
  if (fromSplit != null) return fromSplit

  const parsed = row.dimensions?.trim() ? parseListingDimensionsColumn(row.dimensions) : null
  if (parsed?.boardVolumeL.trim()) {
    const fromDimensions = parseVolumeLiters(parsed.boardVolumeL)
    if (fromDimensions != null) return fromDimensions
  }

  return volumeFromTitle(row.title)
}
