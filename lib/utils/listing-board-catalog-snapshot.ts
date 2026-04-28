import {
  formatBoardLengthForTitle,
  formatBoardLengthInputFromParts,
  formatDecimalDimension,
} from "@/lib/board-measurements"

function dimensionInchesLabel(raw: string): string {
  const t = raw.trim().replace(/\s+/g, " ")
  if (!t) return ""
  if (/["']|\bin\.?\b$/i.test(t)) return t
  return `${t}"`
}

function volumeLabel(vol: string): string {
  const t = vol.trim()
  if (!t) return ""
  if (/[lL]$/u.test(t)) return t
  if (/^\d+([\s.,]\d+)*([\s.,]\/\d+)*$/u.test(t.replace(/\s/g, " "))) {
    const n = t.replace(",", ".")
    return `${n}L`
  }
  return t
}

export type SellFormBoardCatalogSlice = {
  boardLength: string
  boardWidthInches: string
  boardThicknessInches: string
  boardVolumeL: string
  boardBrandId: string
  boardIndexBrandSlug: string
  boardIndexModelSlug: string
  boardIndexLabel: string
  category: string
  condition: string
  brand: string
  price: string
  boardFins: string
}

export type BoardCatalogDimensionLabels = {
  dimensions_summary: string
  length_label: string
  width_label: string
  thickness_label: string
  volume_label: string
}

/**
 * Canonical labels aligned with marketplace display + variant editor prefill (short strings).
 */
export function buildBoardCatalogDimensionLabels(
  slice: Pick<
    SellFormBoardCatalogSlice,
    | "boardLength"
    | "boardWidthInches"
    | "boardThicknessInches"
    | "boardVolumeL"
  >,
): BoardCatalogDimensionLabels {
  const length_label = formatBoardLengthForTitle(slice.boardLength.trim()).trim()

  const width_label = dimensionInchesLabel(slice.boardWidthInches)
  const thickness_label = dimensionInchesLabel(slice.boardThicknessInches)
  const volume_label = volumeLabel(slice.boardVolumeL)

  const pieces = [length_label, width_label, thickness_label].filter(Boolean)
  const mid = pieces.join(" × ")
  const dimensions_summary = volume_label.trim() ? `${mid}${mid ? " — " : ""}${volume_label}` : mid

  return {
    dimensions_summary: dimensions_summary.trim() || "",
    length_label,
    width_label,
    thickness_label,
    volume_label,
  }
}

/** Same labels as {@link buildBoardCatalogDimensionLabels}, built from a `listings` row (live seller data). */
export type ListingRowDimensionSource = {
  length_feet?: number | null
  length_inches?: number | null
  length_inches_display?: string | null
  width?: number | null
  width_inches_display?: string | null
  thickness?: number | null
  thickness_inches_display?: string | null
  volume?: number | null
  volume_display?: string | null
}

export function buildBoardCatalogDimensionLabelsFromListingRow(
  listing: ListingRowDimensionSource,
): BoardCatalogDimensionLabels {
  const feetStr =
    listing.length_feet != null && Number.isFinite(Number(listing.length_feet))
      ? String(Math.trunc(Number(listing.length_feet)))
      : ""
  const inchForLength =
    listing.length_inches_display?.trim() ||
    (listing.length_inches != null &&
    Number.isFinite(Number(listing.length_inches)) &&
    Number(listing.length_inches) !== 0
      ? String(listing.length_inches)
      : "")
  const boardLength = formatBoardLengthInputFromParts(feetStr, inchForLength)

  const boardWidthInches =
    listing.width_inches_display?.trim() ||
    (listing.width != null && Number.isFinite(Number(listing.width))
      ? formatDecimalDimension(Number(listing.width))
      : "") ||
    ""

  const boardThicknessInches =
    listing.thickness_inches_display?.trim() ||
    (listing.thickness != null && Number.isFinite(Number(listing.thickness))
      ? formatDecimalDimension(Number(listing.thickness))
      : "") ||
    ""

  const boardVolumeL =
    listing.volume_display?.trim() ||
    (listing.volume != null && Number.isFinite(Number(listing.volume))
      ? formatDecimalDimension(Number(listing.volume))
      : "") ||
    ""

  return buildBoardCatalogDimensionLabels({
    boardLength,
    boardWidthInches,
    boardThicknessInches,
    boardVolumeL,
  })
}
