import { FINS_SECTION } from "@/lib/fin-listing-config"
import { defaultListingSectionCarton } from "@/lib/listing-section-cartons"
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
  parseSurfboardShippingTierId,
  resolveSurfboardShippingTierFromBoardLengthIn,
  surfboardShippingTierUsesUpsParcelLimits,
  validateSurfboardShippingTierParcelLimits,
  type SurfboardShippingTierId,
} from "@/lib/surfboard-shipping-tiers"
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
  id?: string | null
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

/**
 * Surfboard carton / board-length heuristics are only for explicit surfboard rows.
 * A blank or omitted `section` must not fail open as a board: quote and
 * payment-intent loads that skip the column still carry leftover `dimensions`
 * or a 78″ box — the path that produced the ~$300 fin Ground rate.
 */
function shouldUseSurfboardPackedParcelPath(row: ListingPackedParcelSource): boolean {
  return isSurfboardListingSection(row.section)
}

function sectionDefaultPackedParcelResult(section: string | null | undefined): {
  ok: true
  source: ResolvedPackedParcelSource
  weightOz: number
  lengthIn: number
  widthIn: number
  heightIn: number
} | null {
  const carton = defaultListingSectionCarton(section)
  if (!carton) return null
  return {
    ok: true,
    source: "heuristic",
    weightOz: carton.weightOz,
    lengthIn: carton.lengthIn,
    widthIn: carton.widthIn,
    heightIn: carton.heightIn,
  }
}

function finDefaultPackedParcelResult(): {
  ok: true
  source: ResolvedPackedParcelSource
  weightOz: number
  lengthIn: number
  widthIn: number
  heightIn: number
} {
  return (
    sectionDefaultPackedParcelResult(FINS_SECTION) ?? {
      ok: true,
      source: "heuristic",
      weightOz: FIN_RESWELL_DEFAULT_PACKAGE_WEIGHT_OZ_NUM,
      lengthIn: FIN_RESWELL_DEFAULT_PACKAGE_LENGTH_IN_NUM,
      widthIn: FIN_RESWELL_DEFAULT_PACKAGE_WIDTH_IN_NUM,
      heightIn: FIN_RESWELL_DEFAULT_PACKAGE_HEIGHT_IN_NUM,
    }
  )
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
  const stored = parseSurfboardShippingTierId(row.shipping_package_tier)
  if (stored) return stored
  const lengthIn = boardLengthInchesFromListing(row)
  if (lengthIn == null || lengthIn <= 0) return null
  return resolveSurfboardShippingTierFromBoardLengthIn(lengthIn)
}

/**
 * True when the listing has a seller/shop packed box. Those parcels are gated by
 * carrier DIM/weight, not a stock shortboard / midlength / longboard carton.
 */
export function listingUsesAdminCustomSurfboardCarton(
  row: ListingPackedParcelSource,
): boolean {
  const Ls = num(row.shipping_packed_length_in)
  const Ws = num(row.shipping_packed_width_in)
  const Hs = num(row.shipping_packed_height_in)
  return Boolean(Ls && Ws && Hs && storedPackedSurfboardDimsInRange(Ls, Ws, Hs))
}

/**
 * Resolves outer-carton L×W×H from the stored packed box, or board-size heuristics.
 * Stock compact / medium / midlength / longboard cartons are not used.
 */
function resolveSurfboardPackedParcelDims(
  row: ListingPackedParcelSource,
): PackedParcelDims | null {
  const Ls = num(row.shipping_packed_length_in)
  const Ws = num(row.shipping_packed_width_in)
  const Hs = num(row.shipping_packed_height_in)
  if (Ls && Ws && Hs && storedPackedSurfboardDimsInRange(Ls, Ws, Hs)) {
    return { lengthIn: Ls, widthIn: Ws, heightIn: Hs }
  }
  return suggestPackedBoxInchesFromListing(row)
}

function surfboardWeightOzFromListing(row: ListingPackedParcelSource): number | null {
  const stored = num(row.shipping_packed_weight_oz)
  if (
    stored != null &&
    stored >= RESWELL_MIN_REASONABLE_STORED_PARCEL_WEIGHT_OZ &&
    stored <= RESWELL_MAX_REASONABLE_STORED_PARCEL_WEIGHT_OZ
  ) {
    return stored
  }
  const boardLength = boardLengthFormFromListing(row)
  if (!boardLength) return null
  const parsedDims = row.dimensions?.trim() ? parseListingDimensionsColumn(row.dimensions) : null
  const wt = reswellSuggestedShipWeightLbOzFromBoard({
    boardLength,
    boardVolumeL: parsedDims?.boardVolumeL?.trim() ?? "",
  })
  if (!wt) return null
  const lb = wt.lb.trim() === "" ? 0 : parseFloat(wt.lb.replace(/,/g, ""))
  const oz = wt.oz.trim() === "" ? 0 : parseFloat(wt.oz.replace(/,/g, ""))
  if (!Number.isFinite(lb) || lb < 0 || !Number.isFinite(oz) || oz < 0 || oz >= 16) return null
  const total = lb * 16 + oz
  return Number.isFinite(total) && total > 0 ? total : null
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
 * **Fins and other small parcels:** seller-entered or default packed dims apply. A leaked
 * surfboard tier, leftover board `dimensions`, or 78″ carton on these rows is ignored so
 * checkout does not quote board-sized UPS Ground (hundreds of dollars) for a fin set.
 */
export type ResolvedPackedParcel = {
  source: ResolvedPackedParcelSource
  weightOz: number
  lengthIn: number
  widthIn: number
  heightIn: number
}

/** Units of a listing in this box. Surfboard cartons stay one row = one board. */
export function checkoutParcelLineQuantity(
  row: ListingPackedParcelSource,
  quantities?: Record<string, number> | null,
): number {
  if (isSurfboardListingSection(row.section)) return 1
  const id = row.id?.trim()
  if (!id || !quantities) return 1
  const qty = Math.floor(quantities[id] ?? 1)
  return Number.isFinite(qty) && qty >= 1 ? qty : 1
}

/**
 * Shop solo packed weights (e.g. 2 lb “small”) are mostly mailer + packing.
 * Extra nested units only add this fraction as product weight (floored at
 * {@link RESWELL_FALLBACK_SMALL_PARCEL_WEIGHT_OZ}).
 */
export const SMALL_PARCEL_EXTRA_PRODUCT_WEIGHT_FRACTION = 0.25

/**
 * One mailer for soft goods. Solo listing dims are already a full outer carton;
 * leashes/fins/etc. nest into that same box. Use the largest oriented L×W×H and
 * do **not** grow height with quantity — stacking carton volumes was rating five
 * flat leashes as a 20″ tower.
 */
function packSmallParcelBundle(
  items: Array<{ lengthIn: number; widthIn: number; heightIn: number; quantity: number }>,
): { lengthIn: number; widthIn: number; heightIn: number } {
  let maxLength = 0
  let maxWidth = 0
  let maxHeight = 0
  for (const item of items) {
    if (item.quantity < 1) continue
    const sides = [item.lengthIn, item.widthIn, item.heightIn].sort((a, b) => b - a)
    maxLength = Math.max(maxLength, sides[0] ?? 0)
    maxWidth = Math.max(maxWidth, sides[1] ?? 0)
    maxHeight = Math.max(maxHeight, sides[2] ?? 0)
  }
  const round2 = (value: number) => Math.round(value * 100) / 100
  return {
    lengthIn: round2(maxLength),
    widthIn: round2(maxWidth),
    heightIn: round2(maxHeight),
  }
}

/** Product-only add-on when nesting another carton-heavy soft item into a shared box. */
export function softParcelExtraProductWeightOz(packedWeightOz: number): number {
  return Math.max(
    RESWELL_FALLBACK_SMALL_PARCEL_WEIGHT_OZ,
    Math.round(packedWeightOz * SMALL_PARCEL_EXTRA_PRODUCT_WEIGHT_FRACTION * 100) / 100,
  )
}

/**
 * Soft-parcel line weights include a solo mailer. Light lines (under 16 oz) are
 * treated as product-accurate and summed in full. Carton-heavy lines keep one full
 * packed weight (mailer + item); each extra adds only estimated product weight so
 * five 2 lb shop-small leashes rate near 4 lb, not 8–10 lb.
 */
export function combineSmallParcelPackedWeightsOz(unitWeightsOz: number[]): number {
  if (unitWeightsOz.length === 0) return 0
  if (unitWeightsOz.length === 1) {
    return Math.round(unitWeightsOz[0]! * 100) / 100
  }
  const light = unitWeightsOz.filter((weightOz) => weightOz < 16)
  const heavy = unitWeightsOz
    .filter((weightOz) => weightOz >= 16)
    .sort((a, b) => b - a)
  const lightSum = light.reduce((sum, weightOz) => sum + weightOz, 0)
  if (heavy.length === 0) {
    return Math.round(lightSum * 100) / 100
  }
  let heavySum = heavy[0]!
  for (const weightOz of heavy.slice(1)) {
    heavySum += softParcelExtraProductWeightOz(weightOz)
  }
  return Math.round((lightSum + heavySum) * 100) / 100
}

function expandSmallParcelUnitWeightsOz(
  parcels: ResolvedPackedParcel[],
  rows: ListingPackedParcelSource[],
  quantities?: Record<string, number> | null,
): number[] {
  const weights: number[] = []
  for (let index = 0; index < parcels.length; index += 1) {
    const qty = checkoutParcelLineQuantity(rows[index]!, quantities)
    const weightOz = parcels[index]!.weightOz
    for (let i = 0; i < qty; i += 1) {
      weights.push(weightOz)
    }
  }
  return weights
}

/**
 * Combined one-box parcel for multiple listings shipped together (same seller).
 *
 * **2–3 surfboards:** length = longest bare board + 4″, 2 boards 22″ × 5″,
 * 3 boards 27″ × 7″, weight = 22 lb. Single-board tier cartons are not used.
 *
 * **One surfboard plus small goods:** the board carton, plus each item's weight
 * times its quantity.
 *
 * **Small parcels only:** one mailer sized to the largest solo carton (L×W×H
 * stay the same as one item — soft goods nest). Carton-heavy weights keep one
 * full packed weight, then add product-only extras; light weights add in full.
 */
export function resolveCombinedPackedParcelFromListings(
  rows: ListingPackedParcelSource[],
  quantities?: Record<string, number> | null,
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

  const rawTotalWeightOz =
    Math.round(
      parcels.reduce((sum, parcel, index) => {
        const qty = checkoutParcelLineQuantity(rows[index]!, quantities)
        return sum + parcel.weightOz * qty
      }, 0) * 100,
    ) / 100

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

  if (surfboardCount === 0) {
    const packed = packSmallParcelBundle(
      parcels.map((parcel, index) => ({
        lengthIn: parcel.lengthIn,
        widthIn: parcel.widthIn,
        heightIn: parcel.heightIn,
        quantity: checkoutParcelLineQuantity(rows[index]!, quantities),
      })),
    )
    const weightOz = combineSmallParcelPackedWeightsOz(
      expandSmallParcelUnitWeightsOz(parcels, rows, quantities),
    )
    return finishResolvedParcel("heuristic", packed, weightOz, null)
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
    weightOz: rawTotalWeightOz,
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

function resolveSmallPackedParcelFromListing(row: ListingPackedParcelSource):
  | {
      ok: true
      source: ResolvedPackedParcelSource
      weightOz: number
      lengthIn: number
      widthIn: number
      heightIn: number
    }
  | { ok: false; error: string } {
  const Woz = num(row.shipping_packed_weight_oz)
  const Ls = num(row.shipping_packed_length_in)
  const Ws = num(row.shipping_packed_width_in)
  const Hs = num(row.shipping_packed_height_in)
  if (Ls && Ws && Hs && storedPackedSmallParcelDimsLookUsable(Ls, Ws, Hs)) {
    const weightOz = finFallbackSmallParcelWeightOz(row, Woz)
    return finishResolvedParcel(
      "heuristic",
      { lengthIn: Ls, widthIn: Ws, heightIn: Hs },
      weightOz,
      null,
    )
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
  const sectionParcel = sectionDefaultPackedParcelResult(row.section)
  if (sectionParcel) {
    const limitCheck = validateResolvedParcelForCarrier(
      {
        lengthIn: sectionParcel.lengthIn,
        widthIn: sectionParcel.widthIn,
        heightIn: sectionParcel.heightIn,
        weightOz: sectionParcel.weightOz,
      },
      null,
    )
    if (!limitCheck.ok) return limitCheck
    return sectionParcel
  }
  return {
    ok: false,
    error:
      "This listing is missing packed shipping dimensions. Ask the seller to update Reswell shipping.",
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
  if (!shouldUseSurfboardPackedParcelPath(row)) {
    return resolveSmallPackedParcelFromListing(row)
  }

  const Woz = num(row.shipping_packed_weight_oz)
  const surfboardTierId = resolveSurfboardShippingTierIdFromListing(row)
  const parcelDims = resolveSurfboardPackedParcelDims(row)
  if (!parcelDims) {
    return {
      ok: false,
      error:
        "This listing is missing packed shipping dimensions. Ask the seller to update Reswell shipping.",
    }
  }
  const weightOz = surfboardWeightOzFromListing(row)
  if (weightOz == null) {
    return {
      ok: false,
      error:
        "This listing is missing a shipping weight. Ask the seller to update Reswell shipping (lb + oz).",
    }
  }
  const source =
    listingUsesAdminCustomSurfboardCarton(row) && Woz != null
      ? "board+saved-weight"
      : "board+heuristic-weight"
  return finishResolvedParcel(source, parcelDims, weightOz, surfboardTierId, {
    adminCustomCarton: true,
  })
}
