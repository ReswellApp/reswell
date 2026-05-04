import { formatBoardLengthInputFromParts } from "@/lib/board-measurements"
import {
  applyReswellShippingAxisBuffer,
  reswellSuggestedPackageInchesFromBoard,
  reswellSuggestedShipWeightLbOzFromBoard,
  RESWELL_HEURISTIC_FALLBACK_PACKED_HEIGHT_IN,
  RESWELL_MAX_REASONABLE_STORED_PARCEL_HEIGHT_IN,
  RESWELL_MAX_REASONABLE_STORED_PARCEL_LENGTH_IN,
  RESWELL_MAX_REASONABLE_STORED_PARCEL_WEIGHT_OZ,
  RESWELL_MAX_REASONABLE_STORED_PARCEL_WIDTH_IN,
  RESWELL_MIN_REASONABLE_STORED_PARCEL_HEIGHT_IN,
  RESWELL_MIN_REASONABLE_STORED_PARCEL_LENGTH_IN,
  RESWELL_MIN_REASONABLE_STORED_PARCEL_WEIGHT_OZ,
  RESWELL_MIN_REASONABLE_STORED_PARCEL_WIDTH_IN,
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

function storedPackedSurfboardDimsLookUsable(lengthIn: number, widthIn: number, heightIn: number, oz: number) {
  if (
    lengthIn < RESWELL_MIN_REASONABLE_STORED_PARCEL_LENGTH_IN ||
    lengthIn > RESWELL_MAX_REASONABLE_STORED_PARCEL_LENGTH_IN
  )
    return false
  if (widthIn < RESWELL_MIN_REASONABLE_STORED_PARCEL_WIDTH_IN || widthIn > RESWELL_MAX_REASONABLE_STORED_PARCEL_WIDTH_IN)
    return false
  if (heightIn < RESWELL_MIN_REASONABLE_STORED_PARCEL_HEIGHT_IN || heightIn > RESWELL_MAX_REASONABLE_STORED_PARCEL_HEIGHT_IN)
    return false
  return (
    oz >= RESWELL_MIN_REASONABLE_STORED_PARCEL_WEIGHT_OZ && oz <= RESWELL_MAX_REASONABLE_STORED_PARCEL_WEIGHT_OZ
  )
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
 * Where a resolved parcel came from:
 *   • `board+saved-weight` — current contract: L×W×H from the board's `length / width / thickness`
 *     fields (mirrored by the sell form's Reswell card auto-sync) + saved `shipping_packed_weight_oz`.
 *   • `board+heuristic-weight` — board dims + weight derived from length/volume when seller hasn't saved a weight.
 *   • `heuristic` — legacy / draft listings missing board dims (very rare).
 */
export type ResolvedPackedParcelSource =
  | "board+saved-weight"
  | "board+heuristic-weight"
  | "heuristic"

/**
 * Resolves L×W×H (in) and weight (oz) for ShipEngine.
 *
 * **Source of truth for L×W×H is the board itself** (`length_feet/length_inches`, `width`, `thickness`),
 * because the sell form's Reswell packed-dimensions card auto-mirrors these values on every edit
 * (see `useEffect` in `app/sell/sell-flow-client.tsx` — calls `reswellParcelAutofillStringsFromBoard`).
 * That makes `shipping_packed_length_in/width_in/height_in` columns redundant and risky:
 * legacy listings persisted +8″/axis padding (commit `d064b3a`'s `RESWELL_PACK_PADDING_TOTAL_PER_AXIS_IN`)
 * which inflated dim weight and 3×'d carrier quotes at checkout.
 *
 * After reading the bare board values, every axis (length, width, height) gets the
 * standard packing buffer applied via {@link applyReswellShippingAxisBuffer} so the
 * outer parcel handed to ShipEngine reflects realistic carton dims (end-cap foam,
 * bubble wrap, carton thickness) — not the bare board.
 *
 * When `shipping_packed_weight_oz` is set, it is preferred; otherwise weight is estimated from
 * board length/volume (same heuristics as the sell flow when lb/oz are left blank).
 */
export function resolvePackedParcelFromListing(row: ListingPackedParcelSource):
  | {
      ok: true
      source: ResolvedPackedParcelSource
      weightOz: number
      lengthIn: number
      widthIn: number
      heightIn: number
    }
  | { ok: false; error: string } {
  const boardLength = boardLengthFormFromListing(row)
  const widthStr =
    row.width_inches_display?.trim() ||
    (row.width != null && Number.isFinite(Number(row.width)) ? String(row.width) : "")
  const thickStr =
    row.thickness_inches_display?.trim() ||
    (row.thickness != null && Number.isFinite(Number(row.thickness)) ? String(row.thickness) : "")
  const volStr =
    row.volume_display?.trim() ||
    (row.volume != null && Number.isFinite(Number(row.volume)) ? String(row.volume) : "")

  const Woz = num(row.shipping_packed_weight_oz)

  if (boardLength) {
    const pkg = reswellSuggestedPackageInchesFromBoard({
      boardLength,
      boardWidthInches: widthStr,
      boardThicknessInches: thickStr,
    })
    const len = pkg?.lengthIn.trim() ? parseFloat(pkg.lengthIn.replace(/,/g, "")) : NaN
    let wid = pkg?.widthIn.trim() ? parseFloat(pkg.widthIn.replace(/,/g, "")) : NaN
    let hgt = pkg?.heightIn.trim() ? parseFloat(pkg.heightIn.replace(/,/g, "")) : NaN

    if (!Number.isFinite(len) || len <= 0) {
      return { ok: false, error: "Could not read board length from this listing." }
    }
    if (!Number.isFinite(wid) || wid <= 0) wid = 20
    if (!Number.isFinite(hgt) || hgt <= 0) hgt = RESWELL_HEURISTIC_FALLBACK_PACKED_HEIGHT_IN

    /** Apply the standard packing buffer to every axis before handing to ShipEngine. */
    const parcelLengthIn = applyReswellShippingAxisBuffer(len)
    const parcelWidthIn = applyReswellShippingAxisBuffer(wid)
    const parcelHeightIn = applyReswellShippingAxisBuffer(hgt)

    if (Woz != null && Woz >= RESWELL_MIN_REASONABLE_STORED_PARCEL_WEIGHT_OZ && Woz <= RESWELL_MAX_REASONABLE_STORED_PARCEL_WEIGHT_OZ) {
      return {
        ok: true,
        source: "board+saved-weight",
        weightOz: Woz,
        lengthIn: parcelLengthIn,
        widthIn: parcelWidthIn,
        heightIn: parcelHeightIn,
      }
    }

    const wt = reswellSuggestedShipWeightLbOzFromBoard({ boardLength, boardVolumeL: volStr })
    if (!wt) {
      return {
        ok: false,
        error:
          "This listing is missing a shipping weight. Ask the seller to update Reswell shipping (lb + oz).",
      }
    }
    const lb = wt.lb.trim() === "" ? 0 : parseFloat(wt.lb.replace(/,/g, ""))
    const oz = wt.oz.trim() === "" ? 0 : parseFloat(wt.oz.replace(/,/g, ""))
    if (!Number.isFinite(lb) || lb < 0 || !Number.isFinite(oz) || oz < 0 || oz >= 16) {
      return { ok: false, error: "Could not estimate package weight for shipping." }
    }
    const heuristicWeight = lb * 16 + oz
    if (!Number.isFinite(heuristicWeight) || heuristicWeight <= 0) {
      return { ok: false, error: "Could not estimate package weight for shipping." }
    }
    return {
      ok: true,
      source: "board+heuristic-weight",
      weightOz: heuristicWeight,
      lengthIn: parcelLengthIn,
      widthIn: parcelWidthIn,
      heightIn: parcelHeightIn,
    }
  }

  /** No board dims at all — legacy/draft path. Fall back to stored packed values if they look usable. */
  const Ls = num(row.shipping_packed_length_in)
  const Ws = num(row.shipping_packed_width_in)
  const Hs = num(row.shipping_packed_height_in)
  if (Ls && Ws && Hs && Woz && storedPackedSurfboardDimsLookUsable(Ls, Ws, Hs, Woz)) {
    return {
      ok: true,
      source: "heuristic",
      weightOz: Woz,
      lengthIn: Ls,
      widthIn: Ws,
      heightIn: Hs,
    }
  }
  return {
    ok: false,
    error:
      "This listing is missing board dimensions. Ask the seller to enter length, width, and thickness.",
  }
}
