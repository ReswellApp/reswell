import { formatBoardLengthForTitle } from "@/lib/board-measurements"

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
