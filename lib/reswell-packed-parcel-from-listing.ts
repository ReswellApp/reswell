import { FINS_SECTION } from "@/lib/fin-listing-config"
import {
  applyFinReswellPackageDefaultsPerField,
  finReswellPackageFormFieldsFromListingRow,
  FIN_RESWELL_DEFAULT_PACKAGE_HEIGHT_IN_NUM,
  FIN_RESWELL_DEFAULT_PACKAGE_LENGTH_IN_NUM,
  FIN_RESWELL_DEFAULT_PACKAGE_WEIGHT_OZ_NUM,
  FIN_RESWELL_DEFAULT_PACKAGE_WIDTH_IN_NUM,
} from "@/lib/fin-reswell-shipping-defaults"
import { parseListingDimensionsColumn } from "@/lib/listing-dimensions-storage"
import {
  applyReswellShippingAxisBuffer,
  reswellSuggestedPackageInchesFromBoard,
  reswellSuggestedShipWeightLbOzFromBoard,
  RESWELL_HEURISTIC_FALLBACK_PACKED_HEIGHT_IN,
  RESWELL_MAX_REASONABLE_STORED_PARCEL_HEIGHT_IN,
  RESWELL_MAX_REASONABLE_STORED_PARCEL_LENGTH_IN,
  RESWELL_MAX_REASONABLE_STORED_PARCEL_WEIGHT_OZ,
  RESWELL_MAX_REASONABLE_STORED_PARCEL_WIDTH_IN,
  RESWELL_FALLBACK_SMALL_PARCEL_WEIGHT_OZ,
  RESWELL_MAX_REASONABLE_SMALL_PARCEL_HEIGHT_IN,
  RESWELL_MAX_REASONABLE_SMALL_PARCEL_LENGTH_IN,
  RESWELL_MAX_REASONABLE_SMALL_PARCEL_WIDTH_IN,
  RESWELL_MIN_REASONABLE_SMALL_PARCEL_HEIGHT_IN,
  RESWELL_MIN_REASONABLE_SMALL_PARCEL_LENGTH_IN,
  RESWELL_MIN_REASONABLE_SMALL_PARCEL_WIDTH_IN,
  RESWELL_MIN_REASONABLE_STORED_PARCEL_HEIGHT_IN,
  RESWELL_MIN_REASONABLE_STORED_PARCEL_LENGTH_IN,
  RESWELL_MIN_REASONABLE_STORED_PARCEL_WEIGHT_OZ,
  RESWELL_MIN_REASONABLE_STORED_PARCEL_WIDTH_IN,
} from "@/lib/surfboard-shipping-estimates"

export type ListingPackedParcelSource = {
  section?: string | null
  shipping_packed_length_in?: number | string | null
  shipping_packed_width_in?: number | string | null
  shipping_packed_height_in?: number | string | null
  shipping_packed_weight_oz?: number | string | null
  /** Canonical board L×W×T×vol string — sole source for parcel L/W/H + weight heuristics. */
  dimensions?: string | null
}

function num(v: unknown): number | null {
  if (v == null || v === "") return null
  const n = typeof v === "number" ? v : parseFloat(String(v).replace(/,/g, ""))
  return Number.isFinite(n) && n > 0 ? n : null
}

function storedPackedSmallParcelDimsLookUsable(lengthIn: number, widthIn: number, heightIn: number) {
  return (
    lengthIn >= RESWELL_MIN_REASONABLE_SMALL_PARCEL_LENGTH_IN &&
    lengthIn <= RESWELL_MAX_REASONABLE_SMALL_PARCEL_LENGTH_IN &&
    widthIn >= RESWELL_MIN_REASONABLE_SMALL_PARCEL_WIDTH_IN &&
    widthIn <= RESWELL_MAX_REASONABLE_SMALL_PARCEL_WIDTH_IN &&
    heightIn >= RESWELL_MIN_REASONABLE_SMALL_PARCEL_HEIGHT_IN &&
    heightIn <= RESWELL_MAX_REASONABLE_SMALL_PARCEL_HEIGHT_IN
  )
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

function finListingUsesDefaultPackedParcel(row: ListingPackedParcelSource): boolean {
  return row.section?.trim() === FINS_SECTION
}

function finDefaultPackedParcelResult(): {
  ok: true
  source: ResolvedPackedParcelSource
  weightOz: number
  lengthIn: number
  widthIn: number
  heightIn: number
} {
  return {
    ok: true,
    source: "heuristic",
    weightOz: FIN_RESWELL_DEFAULT_PACKAGE_WEIGHT_OZ_NUM,
    lengthIn: FIN_RESWELL_DEFAULT_PACKAGE_LENGTH_IN_NUM,
    widthIn: FIN_RESWELL_DEFAULT_PACKAGE_WIDTH_IN_NUM,
    heightIn: FIN_RESWELL_DEFAULT_PACKAGE_HEIGHT_IN_NUM,
  }
}

function finPackedParcelResultFromStoredRow(
  row: ListingPackedParcelSource,
): {
  ok: true
  source: ResolvedPackedParcelSource
  weightOz: number
  lengthIn: number
  widthIn: number
  heightIn: number
} | null {
  const merged = applyFinReswellPackageDefaultsPerField(finReswellPackageFormFieldsFromListingRow(row))
  const Ls = num(merged.reswellPackageLengthIn)
  const Ws = num(merged.reswellPackageWidthIn)
  const Hs = num(merged.reswellPackageHeightIn)
  if (!Ls || !Ws || !Hs || !storedPackedSmallParcelDimsLookUsable(Ls, Ws, Hs)) {
    return null
  }
  const lbRaw = merged.reswellPackageWeightLb?.trim() ?? ""
  const ozRaw = merged.reswellPackageWeightOz?.trim() ?? ""
  const lb = lbRaw === "" ? 0 : Number.parseFloat(lbRaw.replace(/,/g, ""))
  const oz = ozRaw === "" ? 0 : Number.parseFloat(ozRaw.replace(/,/g, ""))
  if (!Number.isFinite(lb) || lb < 0 || !Number.isFinite(oz) || oz < 0 || oz >= 16) {
    return finDefaultPackedParcelResult()
  }
  const totalOz = lb * 16 + oz
  if (!Number.isFinite(totalOz) || totalOz <= 0) {
    return finDefaultPackedParcelResult()
  }
  return {
    ok: true,
    source: "heuristic",
    weightOz: totalOz,
    lengthIn: Ls,
    widthIn: Ws,
    heightIn: Hs,
  }
}

function finFallbackSmallParcelWeightOz(row: ListingPackedParcelSource, storedWeightOz: number | null): number {
  if (
    storedWeightOz != null &&
    storedWeightOz >= 1 &&
    storedWeightOz <= RESWELL_MAX_REASONABLE_STORED_PARCEL_WEIGHT_OZ
  ) {
    return storedWeightOz
  }
  return finListingUsesDefaultPackedParcel(row)
    ? FIN_RESWELL_DEFAULT_PACKAGE_WEIGHT_OZ_NUM
    : RESWELL_FALLBACK_SMALL_PARCEL_WEIGHT_OZ
}

function boardLengthFormFromListing(row: ListingPackedParcelSource): string | null {
  const parsed = row.dimensions?.trim() ? parseListingDimensionsColumn(row.dimensions) : null
  if (parsed?.boardLength.trim()) return parsed.boardLength
  return null
}

/**
 * Where a resolved parcel came from:
 *   • `board+saved-weight` — L×W×H from `listings.dimensions` + saved `shipping_packed_weight_oz`.
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
 * **Source of truth for L×W×H is `listings.dimensions`** (length, width, thickness, volume),
 * which the sell flow keeps in sync with the board fields on every edit
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
export type ResolvedPackedParcel = {
  source: ResolvedPackedParcelSource
  weightOz: number
  lengthIn: number
  widthIn: number
  heightIn: number
}

/**
 * Combined one-box parcel for multiple listings shipped together (same seller).
 *
 * Box sizing policy: every item is assumed to fit in the carton of the **biggest item**
 * (largest L×W×H volume), so the combined parcel uses that item's dimensions and the
 * **sum of every item's weight**. If any listing cannot resolve a parcel, the whole
 * combination fails — checkout must not silently under-quote.
 */
export function resolveCombinedPackedParcelFromListings(
  rows: ListingPackedParcelSource[],
): { ok: true } & ResolvedPackedParcel | { ok: false; error: string } {
  if (rows.length === 0) {
    return { ok: false, error: "No listings to build a shipping parcel from." }
  }

  const parcels: ResolvedPackedParcel[] = []
  for (const row of rows) {
    const resolved = resolvePackedParcelFromListing(row)
    if (!resolved.ok) {
      return resolved
    }
    parcels.push(resolved)
  }

  let biggest = parcels[0]!
  let biggestVolume = biggest.lengthIn * biggest.widthIn * biggest.heightIn
  for (const p of parcels.slice(1)) {
    const v = p.lengthIn * p.widthIn * p.heightIn
    if (v > biggestVolume) {
      biggest = p
      biggestVolume = v
    }
  }

  const totalWeightOz = Math.round(parcels.reduce((sum, p) => sum + p.weightOz, 0) * 100) / 100

  return {
    ok: true,
    source: biggest.source,
    weightOz: totalWeightOz,
    lengthIn: biggest.lengthIn,
    widthIn: biggest.widthIn,
    heightIn: biggest.heightIn,
  }
}

/**
 * Suggested outer box L×W×H from board dimensions only (no weight).
 * Used to pre-fill seller label forms for flat/free shipping — weight must be entered by the seller.
 */
export function suggestPackedBoxInchesFromListing(
  row: ListingPackedParcelSource,
): { lengthIn: number; widthIn: number; heightIn: number } | null {
  const boardLength = boardLengthFormFromListing(row)
  if (!boardLength) return null
  const parsedDims = row.dimensions?.trim() ? parseListingDimensionsColumn(row.dimensions) : null
  const widthStr = parsedDims?.boardWidthInches?.trim() ?? ""
  const thickStr = parsedDims?.boardThicknessInches?.trim() ?? ""
  const pkg = reswellSuggestedPackageInchesFromBoard({
    boardLength,
    boardWidthInches: widthStr,
    boardThicknessInches: thickStr,
  })
  const len = pkg?.lengthIn.trim() ? parseFloat(pkg.lengthIn.replace(/,/g, "")) : NaN
  let wid = pkg?.widthIn.trim() ? parseFloat(pkg.widthIn.replace(/,/g, "")) : NaN
  let hgt = pkg?.heightIn.trim() ? parseFloat(pkg.heightIn.replace(/,/g, "")) : NaN
  if (!Number.isFinite(len) || len <= 0) return null
  if (!Number.isFinite(wid) || wid <= 0) wid = 20
  if (!Number.isFinite(hgt) || hgt <= 0) hgt = RESWELL_HEURISTIC_FALLBACK_PACKED_HEIGHT_IN
  return {
    lengthIn: applyReswellShippingAxisBuffer(len),
    widthIn: applyReswellShippingAxisBuffer(wid),
    heightIn: applyReswellShippingAxisBuffer(hgt),
  }
}

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
  const parsedDims = row.dimensions?.trim() ? parseListingDimensionsColumn(row.dimensions) : null
  const widthStr = parsedDims?.boardWidthInches?.trim() ?? ""
  const thickStr = parsedDims?.boardThicknessInches?.trim() ?? ""
  const volStr = parsedDims?.boardVolumeL?.trim() ?? ""

  const Woz = num(row.shipping_packed_weight_oz)

  if (boardLength) {
    const suggested = suggestPackedBoxInchesFromListing(row)
    if (!suggested) {
      return { ok: false, error: "Could not read board length from this listing." }
    }
    const { lengthIn: parcelLengthIn, widthIn: parcelWidthIn, heightIn: parcelHeightIn } = suggested

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

  /** No board dims — seller-entered packed box (fins, legacy surfboard rows). */
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
  if (Ls && Ws && Hs && storedPackedSmallParcelDimsLookUsable(Ls, Ws, Hs)) {
    const weightOz = finFallbackSmallParcelWeightOz(row, Woz)
    return {
      ok: true,
      source: "heuristic",
      weightOz,
      lengthIn: Ls,
      widthIn: Ws,
      heightIn: Hs,
    }
  }
  if (finListingUsesDefaultPackedParcel(row)) {
    const finParcel = finPackedParcelResultFromStoredRow(row) ?? finDefaultPackedParcelResult()
    return finParcel
  }
  return {
    ok: false,
    error:
      "This listing is missing packed shipping dimensions. Ask the seller to update Reswell shipping.",
  }
}
