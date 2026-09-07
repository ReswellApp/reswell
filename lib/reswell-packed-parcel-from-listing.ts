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
  getSurfboardShippingTier,
  parseSurfboardShippingTierId,
  surfboardShippingTierFixedParcel,
  surfboardShippingTierUsesUpsParcelLimits,
  validateSurfboardShippingTierParcelLimits,
  type SurfboardShippingTierId,
} from "@/lib/surfboard-shipping-tiers"
import {
  parseSurfboardShippingPackBandId,
  surfboardShippingPackBandFixedParcel,
} from "@/lib/surfboard-shipping-pack-bands"
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
import {
  surfboardShippingDimIn,
  validateSurfboardLabelParcelLimits,
} from "@/lib/shipping/surfboard-label-limits"
import {
  boardLengthInchesFromListing,
  countSurfboardListings,
  isSurfboardListingSection,
  MULTI_SURFBOARD_BOX_WEIGHT_LB,
  multiSurfboardBoxCrossSection,
  multiSurfboardOneBoxLengthIn,
  peerCheckoutSurfboardCountError,
} from "@/lib/surfboard-multi-board-parcel"

export type ListingPackedParcelSource = {
  section?: string | null
  shipping_packed_length_in?: number | string | null
  shipping_packed_width_in?: number | string | null
  shipping_packed_height_in?: number | string | null
  shipping_packed_weight_oz?: number | string | null
  shipping_package_tier?: string | null
  /** Shortboard pack band; null with tier=shortboard means Medium. */
  shipping_package_band?: string | null
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

function storedPackedSurfboardDimsInRange(lengthIn: number, widthIn: number, heightIn: number): boolean {
  return (
    lengthIn >= RESWELL_MIN_REASONABLE_STORED_PARCEL_LENGTH_IN &&
    lengthIn <= RESWELL_MAX_REASONABLE_STORED_PARCEL_LENGTH_IN &&
    widthIn >= RESWELL_MIN_REASONABLE_STORED_PARCEL_WIDTH_IN &&
    widthIn <= RESWELL_MAX_REASONABLE_STORED_PARCEL_WIDTH_IN &&
    heightIn >= RESWELL_MIN_REASONABLE_STORED_PARCEL_HEIGHT_IN &&
    heightIn <= RESWELL_MAX_REASONABLE_STORED_PARCEL_HEIGHT_IN
  )
}

function storedPackedSurfboardDimsLookUsable(lengthIn: number, widthIn: number, heightIn: number, oz: number) {
  if (!storedPackedSurfboardDimsInRange(lengthIn, widthIn, heightIn)) return false
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

type PackedParcelDims = { lengthIn: number; widthIn: number; heightIn: number }

export function resolveSurfboardShippingTierIdFromListing(
  row: ListingPackedParcelSource,
): SurfboardShippingTierId | null {
  return parseSurfboardShippingTierId(row.shipping_package_tier)
}

/**
 * True when the listing uses an admin-entered custom carton (no pack band + stored L×W×H).
 * Those parcels are gated by UPS DIM/weight, not the shortboard 78″ box-length ceiling.
 */
export function listingUsesAdminCustomSurfboardCarton(
  row: ListingPackedParcelSource,
): boolean {
  const tierId = parseSurfboardShippingTierId(row.shipping_package_tier)
  if (!tierId) return false
  if (parseSurfboardShippingPackBandId(row.shipping_package_band)) return false
  const Ls = num(row.shipping_packed_length_in)
  const Ws = num(row.shipping_packed_width_in)
  const Hs = num(row.shipping_packed_height_in)
  return Boolean(Ls && Ws && Hs && storedPackedSurfboardDimsInRange(Ls, Ws, Hs))
}

/**
 * Resolves outer-carton L×W×H for surfboard listings from the stored tier or saved packed dims.
 *
 * Explicit pack band → fixed band carton.
 * Null band + usable stored dims → admin custom (or legacy persisted) carton.
 * Null shortboard band + no stored dims → Medium (legacy).
 */
function resolveSurfboardPackedParcelDims(
  row: ListingPackedParcelSource,
): PackedParcelDims | null {
  const tierId = parseSurfboardShippingTierId(row.shipping_package_tier)
  const Ls = num(row.shipping_packed_length_in)
  const Ws = num(row.shipping_packed_width_in)
  const Hs = num(row.shipping_packed_height_in)
  const stored =
    Ls && Ws && Hs && storedPackedSurfboardDimsInRange(Ls, Ws, Hs)
      ? { lengthIn: Ls, widthIn: Ws, heightIn: Hs }
      : null

  if (tierId) {
    const explicitBandId = parseSurfboardShippingPackBandId(row.shipping_package_band)
    if (explicitBandId) {
      const band = surfboardShippingPackBandFixedParcel(explicitBandId)
      return {
        lengthIn: band.lengthIn,
        widthIn: band.widthIn,
        heightIn: band.heightIn,
      }
    }

    // Admin custom carton (or legacy row that persisted packed dims without a band).
    if (stored) return stored

    if (tierId === "shortboard") {
      const medium = surfboardShippingPackBandFixedParcel("shortboard_medium")
      return {
        lengthIn: medium.lengthIn,
        widthIn: medium.widthIn,
        heightIn: medium.heightIn,
      }
    }

    const fixed = surfboardShippingTierFixedParcel(tierId)
    return {
      lengthIn: fixed.lengthIn,
      widthIn: fixed.widthIn,
      heightIn: fixed.heightIn,
    }
  }

  return stored
}

function surfboardTierWeightOzFromListing(row: ListingPackedParcelSource): number | null {
  const tierId = parseSurfboardShippingTierId(row.shipping_package_tier)
  if (tierId) {
    const explicitBandId = parseSurfboardShippingPackBandId(row.shipping_package_band)
    if (explicitBandId) {
      return surfboardShippingPackBandFixedParcel(explicitBandId).weightLb * 16
    }
    // Custom carton weight comes from shipping_packed_weight_oz (caller prefers saved).
    // Fall back to Medium / tier defaults only when weight wasn't persisted.
    if (tierId === "shortboard") {
      return surfboardShippingPackBandFixedParcel("shortboard_medium").weightLb * 16
    }
    return getSurfboardShippingTier(tierId).weightLb * 16
  }
  return null
}

function validateResolvedParcelForCarrier(
  parcel: PackedParcelDims & { weightOz: number },
  tierId: SurfboardShippingTierId | null,
  options?: { adminCustomCarton?: boolean },
): { ok: true } | { ok: false; error: string } {
  const weightLb = Math.max(1 / 16, parcel.weightOz / 16)
  const dims = {
    lengthIn: parcel.lengthIn,
    widthIn: parcel.widthIn,
    heightIn: parcel.heightIn,
    weightLb,
  }

  if (tierId) {
    const tierCheck = validateSurfboardShippingTierParcelLimits(tierId, dims, {
      adminCustomCarton: options?.adminCustomCarton === true,
    })
    if (!tierCheck.ok) return tierCheck
    if (surfboardShippingTierUsesUpsParcelLimits(tierId)) {
      return validateSurfboardLabelParcelLimits(dims)
    }
    return { ok: true }
  }

  return validateSurfboardLabelParcelLimits(dims)
}

function finishResolvedParcel(
  source: ResolvedPackedParcelSource,
  dims: PackedParcelDims,
  weightOz: number,
  tierId: SurfboardShippingTierId | null,
  options?: { adminCustomCarton?: boolean },
):
  | {
      ok: true
      source: ResolvedPackedParcelSource
      weightOz: number
      lengthIn: number
      widthIn: number
      heightIn: number
    }
  | { ok: false; error: string } {
  const limitCheck = validateResolvedParcelForCarrier({ ...dims, weightOz }, tierId, options)
  if (!limitCheck.ok) return limitCheck
  return {
    ok: true,
    source,
    weightOz,
    lengthIn: dims.lengthIn,
    widthIn: dims.widthIn,
    heightIn: dims.heightIn,
  }
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
 * **Surfboards:** L×W×H come from persisted tier packed dims (`shipping_packed_*`) when valid,
 * otherwise from the standard shortboard / midlength / longboard tier derived from board length
 * in `listings.dimensions`. Weight prefers saved `shipping_packed_weight_oz`, then the tier default.
 *
 * **Fins and other small parcels:** seller-entered or default packed dims apply.
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
 * **2–3 surfboards:** length = longest bare board + 4″, 2 boards 22″ × 5″,
 * 3 boards 27″ × 7″, weight = 22 lb. Single-board tier cartons are not used.
 *
 * **Otherwise:** largest-DIM item's carton + summed weights (fins/shop add-ons with one board).
 */
export function resolveCombinedPackedParcelFromListings(
  rows: ListingPackedParcelSource[],
): { ok: true } & ResolvedPackedParcel | { ok: false; error: string } {
  if (rows.length === 0) {
    return { ok: false, error: "No listings to build a shipping parcel from." }
  }

  const surfboardCount = countSurfboardListings(rows)
  const countError = peerCheckoutSurfboardCountError(surfboardCount)
  if (countError) {
    return { ok: false, error: countError }
  }

  const parcels: ResolvedPackedParcel[] = []
  for (const row of rows) {
    const resolved = resolvePackedParcelFromListing(row)
    if (!resolved.ok) {
      return resolved
    }
    parcels.push(resolved)
  }

  const totalWeightOz = Math.round(parcels.reduce((sum, p) => sum + p.weightOz, 0) * 100) / 100

  if (surfboardCount >= 2) {
    let longestBoardIn = 0
    for (const row of rows) {
      if (!isSurfboardListingSection(row.section)) continue
      const lengthIn = boardLengthInchesFromListing(row)
      if (lengthIn == null || lengthIn <= 0) {
        return {
          ok: false,
          error:
            "Every surfboard in this checkout needs a listed length so we can quote one shared shipping box.",
        }
      }
      longestBoardIn = Math.max(longestBoardIn, lengthIn)
    }
    if (longestBoardIn <= 0) {
      return { ok: false, error: "Could not read surfboard length for this order." }
    }

    const cross = multiSurfboardBoxCrossSection(surfboardCount)
    return {
      ok: true,
      source: "board+heuristic-weight",
      weightOz: MULTI_SURFBOARD_BOX_WEIGHT_LB * 16,
      lengthIn: multiSurfboardOneBoxLengthIn(longestBoardIn),
      widthIn: cross.widthIn,
      heightIn: cross.heightIn,
    }
  }

  let biggest = parcels[0]!
  let biggestDim = surfboardShippingDimIn(biggest.lengthIn, biggest.widthIn, biggest.heightIn)
  for (const p of parcels.slice(1)) {
    const dim = surfboardShippingDimIn(p.lengthIn, p.widthIn, p.heightIn)
    if (dim > biggestDim) {
      biggest = p
      biggestDim = dim
    }
  }

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
  const surfboardTierId = resolveSurfboardShippingTierIdFromListing(row)
  const adminCustomCarton = listingUsesAdminCustomSurfboardCarton(row)
  const cartonOpts = { adminCustomCarton }

  if (surfboardTierId) {
    const parcelDims = resolveSurfboardPackedParcelDims(row)
    if (!parcelDims) {
      return {
        ok: false,
        error: "This listing is missing a Reswell shipping size. Ask the seller to choose shortboard, midlength, or longboard.",
      }
    }
    const tierWeightOz = surfboardTierWeightOzFromListing(row)
    if (tierWeightOz == null) {
      return { ok: false, error: "Could not resolve shipping weight for this listing." }
    }
    const weightOz =
      Woz != null &&
      Woz >= RESWELL_MIN_REASONABLE_STORED_PARCEL_WEIGHT_OZ &&
      Woz <= RESWELL_MAX_REASONABLE_STORED_PARCEL_WEIGHT_OZ
        ? Woz
        : tierWeightOz
    return finishResolvedParcel(
      Woz != null ? "board+saved-weight" : "board+heuristic-weight",
      parcelDims,
      weightOz,
      surfboardTierId,
      cartonOpts,
    )
  }

  if (boardLength) {
    const parcelDims = resolveSurfboardPackedParcelDims(row)
    if (!parcelDims) {
      return {
        ok: false,
        error:
          "This listing is missing a Reswell shipping size. Ask the seller to choose shortboard, midlength, or longboard.",
      }
    }

    if (Woz != null && Woz >= RESWELL_MIN_REASONABLE_STORED_PARCEL_WEIGHT_OZ && Woz <= RESWELL_MAX_REASONABLE_STORED_PARCEL_WEIGHT_OZ) {
      return finishResolvedParcel("board+saved-weight", parcelDims, Woz, surfboardTierId, cartonOpts)
    }

    const tierWeightOz = surfboardTierWeightOzFromListing(row)
    if (tierWeightOz != null) {
      return finishResolvedParcel(
        "board+heuristic-weight",
        parcelDims,
        tierWeightOz,
        surfboardTierId,
        cartonOpts,
      )
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
    return finishResolvedParcel(
      "board+heuristic-weight",
      parcelDims,
      heuristicWeight,
      surfboardTierId,
      cartonOpts,
    )
  }

  /** No board dims — seller-entered packed box (fins, legacy surfboard rows). */
  const Ls = num(row.shipping_packed_length_in)
  const Ws = num(row.shipping_packed_width_in)
  const Hs = num(row.shipping_packed_height_in)
  if (Ls && Ws && Hs && Woz && storedPackedSurfboardDimsLookUsable(Ls, Ws, Hs, Woz)) {
    return finishResolvedParcel(
      "heuristic",
      { lengthIn: Ls, widthIn: Ws, heightIn: Hs },
      Woz,
      surfboardTierId,
      cartonOpts,
    )
  }
  if (Ls && Ws && Hs && storedPackedSmallParcelDimsLookUsable(Ls, Ws, Hs)) {
    const weightOz = finFallbackSmallParcelWeightOz(row, Woz)
    const finished = finishResolvedParcel(
      "heuristic",
      { lengthIn: Ls, widthIn: Ws, heightIn: Hs },
      weightOz,
      null,
    )
    if (!finished.ok) return finished
    return finished
  }
  if (finListingUsesDefaultPackedParcel(row)) {
    const finParcel = finPackedParcelResultFromStoredRow(row) ?? finDefaultPackedParcelResult()
    const limitCheck = validateResolvedParcelForCarrier(
      {
        lengthIn: finParcel.lengthIn,
        widthIn: finParcel.widthIn,
        heightIn: finParcel.heightIn,
        weightOz: finParcel.weightOz,
      },
      null,
    )
    if (!limitCheck.ok) return limitCheck
    return finParcel
  }
  return {
    ok: false,
    error:
      "This listing is missing packed shipping dimensions. Ask the seller to update Reswell shipping.",
  }
}
