import { formatBoardLengthInputFromParts } from "@/lib/board-measurements"
import {
  reswellSuggestedPackageInchesFromBoard,
  reswellSuggestedShipWeightLbOzFromBoard,
} from "@/lib/surfboard-shipping-estimates"

export type ListingPackedParcelSource = {
  shipping_packed_length_in?: number | string | null
  shipping_packed_width_in?: number | string | null
  shipping_packed_height_in?: number | string | null
  shipping_packed_weight_oz?: number | string | null
  length_feet?: number | null
  length_inches?: number | string | null
  length_inches_display?: string | null
  width?: number | null
  width_inches_display?: string | null
  thickness?: number | null
  thickness_inches_display?: string | null
  volume?: number | null
  volume_display?: string | null
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""))
  return Number.isFinite(n) && n > 0 ? n : null
}

function boardLengthFormFromListing(row: ListingPackedParcelSource): string | null {
  const ft = row.length_feet
  if (ft == null || !Number.isFinite(Number(ft))) return null
  const inchDisp =
    row.length_inches_display?.trim() ||
    (row.length_inches != null && Number(row.length_inches) !== 0
      ? String(row.length_inches)
      : "")
  return formatBoardLengthInputFromParts(String(ft), inchDisp)
}

/**
 * Resolves L×W×H (in) and weight (oz) for ShipEngine from stored packed fields,
 * or heuristics from board dimensions when packed columns are missing (legacy rows).
 */
export function resolvePackedParcelFromListing(row: ListingPackedParcelSource):
  | { ok: true; weightOz: number; lengthIn: number; widthIn: number; heightIn: number }
  | { ok: false; error: string } {
  const Ls = num(row.shipping_packed_length_in)
  const Ws = num(row.shipping_packed_width_in)
  const Hs = num(row.shipping_packed_height_in)
  const Woz = num(row.shipping_packed_weight_oz)

  if (Ls && Ws && Hs && Woz) {
    return { ok: true, weightOz: Woz, lengthIn: Ls, widthIn: Ws, heightIn: Hs }
  }

  const boardLength = boardLengthFormFromListing(row)
  if (!boardLength) {
    return {
      ok: false,
      error: "This listing is missing packed shipping dimensions. Ask the seller to update the listing.",
    }
  }

  const widthStr =
    row.width_inches_display?.trim() ||
    (row.width != null && Number.isFinite(Number(row.width)) ? String(row.width) : "")
  const thickStr =
    row.thickness_inches_display?.trim() ||
    (row.thickness != null && Number.isFinite(Number(row.thickness)) ? String(row.thickness) : "")

  const volStr =
    row.volume_display?.trim() ||
    (row.volume != null && Number.isFinite(Number(row.volume)) ? String(row.volume) : "")

  const pkg = reswellSuggestedPackageInchesFromBoard({
    boardLength,
    boardWidthInches: widthStr,
    boardThicknessInches: thickStr,
  })
  const wt = reswellSuggestedShipWeightLbOzFromBoard({
    boardLength,
    boardVolumeL: volStr,
  })

  const len = pkg?.lengthIn.trim() ? parseFloat(pkg.lengthIn.replace(/,/g, "")) : NaN
  let wid = pkg?.widthIn.trim() ? parseFloat(pkg.widthIn.replace(/,/g, "")) : NaN
  let hgt = pkg?.heightIn.trim() ? parseFloat(pkg.heightIn.replace(/,/g, "")) : NaN

  if (!Number.isFinite(len) || len <= 0) {
    return { ok: false, error: "Could not estimate package length for shipping." }
  }
  if (!Number.isFinite(wid) || wid <= 0) wid = 20
  if (!Number.isFinite(hgt) || hgt <= 0) hgt = 6

  let weightOz: number
  if (wt) {
    const lb = wt.lb.trim() === "" ? 0 : parseFloat(wt.lb.replace(/,/g, ""))
    const oz = wt.oz.trim() === "" ? 0 : parseFloat(wt.oz.replace(/,/g, ""))
    if (!Number.isFinite(lb) || lb < 0 || !Number.isFinite(oz) || oz < 0 || oz >= 16) {
      return { ok: false, error: "Could not estimate package weight for shipping." }
    }
    weightOz = lb * 16 + oz
  } else {
    return { ok: false, error: "Could not estimate package weight for shipping." }
  }

  if (!Number.isFinite(weightOz) || weightOz <= 0) {
    return { ok: false, error: "Could not estimate package weight for shipping." }
  }

  return { ok: true, weightOz, lengthIn: len, widthIn: wid, heightIn: hgt }
}
