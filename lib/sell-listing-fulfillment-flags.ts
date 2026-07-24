import {
  flagsFromBoardFulfillment,
  type BoardFulfillmentChoice,
} from "@/lib/listing-fulfillment"
import type { BoardShippingCostMode } from "@/lib/sell-form-validation"
import { applySurfboardShippingTierDefaults, parseSurfboardShippingTierId } from "@/lib/surfboard-shipping-tiers"
import {
  parseSurfboardShippingPackBandId,
  resolveSurfboardShippingPackBandId,
  surfboardShippingPackBandFixedParcel,
} from "@/lib/surfboard-shipping-pack-bands"

import {
  parseReswellParcelLengthRawToCarrierInches,
  parseReswellParcelWidthHeightRawToCarrierInches,
  parseReswellPackedWeightToTotalOz,
  isReswellPackedWeightComplete,
} from "@/lib/reswell-parcel-fields"

/**
 * Slice of the surfboard sell form used to persist fulfillment booleans.
 * Kept loose for draft autosave payloads (optional fields).
 */
export type SellFulfillmentPersistInput = {
  boardFulfillment?: BoardFulfillmentChoice | null
  boardShippingCostMode?: BoardShippingCostMode
  boardShippingPrice?: string
  /** Used to derive standard surfboard shipping tiers when parcel fields are blank. */
  boardLength?: string
  category?: string
  /** Seller-selected Reswell surfboard shipping tier (shortboard / midlength / longboard). */
  surfboardShippingTier?: string
  /** Shortboard pack band (compact / standard / max). */
  surfboardShippingPackBand?: string
  reswellPackageLengthIn?: string
  reswellPackageWidthIn?: string
  reswellPackageHeightIn?: string
  reswellPackageWeightLb?: string
  reswellPackageWeightOz?: string
}

function normalizeBoardFulfillmentMode(m: unknown): BoardFulfillmentChoice {
  if (m === "pickup_only" || m === "shipping_only" || m === "pickup_and_shipping") {
    return m
  }
  return "pickup_only"
}


/**
 * Persists packed box + weight for Reswell-calculated shipping.
 * Returns all `null` when L×W×H or weight are invalid (caller should rely on form validation for UX).
 */
export function reswellPackageFieldsToDb(fd: SellFulfillmentPersistInput): {
  shipping_packed_length_in: number | null
  shipping_packed_width_in: number | null
  shipping_packed_height_in: number | null
  shipping_packed_weight_oz: number | null
  shipping_package_tier: string | null
  shipping_package_band: string | null
} {
  const mode = fd.boardShippingCostMode ?? "reswell"
  const tierId = parseSurfboardShippingTierId(fd.surfboardShippingTier)
  const packBandId =
    tierId === "shortboard"
      ? resolveSurfboardShippingPackBandId({
          tierId,
          bandId: fd.surfboardShippingPackBand,
        })
      : null

  if (mode !== "reswell" && mode !== "flat") {
    return {
      shipping_packed_length_in: null,
      shipping_packed_width_in: null,
      shipping_packed_height_in: null,
      shipping_packed_weight_oz: null,
      shipping_package_tier: null,
      shipping_package_band: null,
    }
  }

  if (mode === "flat") {
    return {
      shipping_packed_length_in: null,
      shipping_packed_width_in: null,
      shipping_packed_height_in: null,
      shipping_packed_weight_oz: null,
      shipping_package_tier: tierId,
      shipping_package_band: null,
    }
  }

  if (packBandId) {
    const band = surfboardShippingPackBandFixedParcel(packBandId)
    return {
      shipping_packed_length_in: band.lengthIn,
      shipping_packed_width_in: band.widthIn,
      shipping_packed_height_in: band.heightIn,
      shipping_packed_weight_oz: band.weightLb * 16,
      shipping_package_tier: tierId,
      shipping_package_band: packBandId,
    }
  }

  const resolved = applySurfboardShippingTierDefaults(
    {
      reswellPackageLengthIn: fd.reswellPackageLengthIn ?? "",
      reswellPackageWidthIn: fd.reswellPackageWidthIn ?? "",
      reswellPackageHeightIn: fd.reswellPackageHeightIn ?? "",
      reswellPackageWeightLb: fd.reswellPackageWeightLb ?? "",
      reswellPackageWeightOz: fd.reswellPackageWeightOz ?? "",
      surfboardShippingTier: fd.surfboardShippingTier,
    },
    tierId ? { tierId } : undefined,
  )
  const L = parseReswellParcelLengthRawToCarrierInches(resolved.reswellPackageLengthIn)
  const W = parseReswellParcelWidthHeightRawToCarrierInches(resolved.reswellPackageWidthIn)
  const H = parseReswellParcelWidthHeightRawToCarrierInches(resolved.reswellPackageHeightIn)
  const totalOz = parseReswellPackedWeightToTotalOz(
    resolved.reswellPackageWeightLb,
    resolved.reswellPackageWeightOz,
  )
  if (L == null || L <= 0 || W == null || W <= 0 || H == null || H <= 0 || totalOz == null) {
    return {
      shipping_packed_length_in: null,
      shipping_packed_width_in: null,
      shipping_packed_height_in: null,
      shipping_packed_weight_oz: null,
      shipping_package_tier: tierId,
      shipping_package_band: null,
    }
  }
  return {
    shipping_packed_length_in: L,
    shipping_packed_width_in: W,
    shipping_packed_height_in: H,
    shipping_packed_weight_oz: totalOz,
    shipping_package_tier: tierId,
    shipping_package_band: parseSurfboardShippingPackBandId(fd.surfboardShippingPackBand),
  }
}

/** Restores sell-form strings from persisted `listings.shipping_packed_*` columns. */
export function reswellPackageFormFromDbRow(row: {
  shipping_packed_length_in?: number | string | null
  shipping_packed_width_in?: number | string | null
  shipping_packed_height_in?: number | string | null
  shipping_packed_weight_oz?: number | string | null
}): {
  reswellPackageLengthIn: string
  reswellPackageWidthIn: string
  reswellPackageHeightIn: string
  reswellPackageWeightLb: string
  reswellPackageWeightOz: string
} {
  const empty = {
    reswellPackageLengthIn: "",
    reswellPackageWidthIn: "",
    reswellPackageHeightIn: "",
    reswellPackageWeightLb: "",
    reswellPackageWeightOz: "",
  }
  const L = row.shipping_packed_length_in
  const W = row.shipping_packed_width_in
  const H = row.shipping_packed_height_in
  const ozTotal = row.shipping_packed_weight_oz
  if (L == null || L === "" || W == null || W === "" || H == null || H === "") {
    return empty
  }
  const nL = typeof L === "number" ? L : parseFloat(String(L).replace(/,/g, ""))
  const nW = typeof W === "number" ? W : parseFloat(String(W).replace(/,/g, ""))
  const nH = typeof H === "number" ? H : parseFloat(String(H).replace(/,/g, ""))
  if (!Number.isFinite(nL) || !Number.isFinite(nW) || !Number.isFinite(nH)) {
    return empty
  }
  if (ozTotal == null || ozTotal === "") {
    return {
      reswellPackageLengthIn: String(nL),
      reswellPackageWidthIn: String(nW),
      reswellPackageHeightIn: String(nH),
      reswellPackageWeightLb: "",
      reswellPackageWeightOz: "",
    }
  }
  const totalOz = typeof ozTotal === "number" ? ozTotal : parseFloat(String(ozTotal).replace(/,/g, ""))
  if (!Number.isFinite(totalOz) || totalOz <= 0) {
    return {
      reswellPackageLengthIn: String(nL),
      reswellPackageWidthIn: String(nW),
      reswellPackageHeightIn: String(nH),
      reswellPackageWeightLb: "",
      reswellPackageWeightOz: "",
    }
  }
  const lb = Math.floor(totalOz / 16)
  const ozRem = Math.round((totalOz - lb * 16) * 100) / 100
  const ozStr =
    Number.isInteger(ozRem) ? String(ozRem) : ozRem.toFixed(2).replace(/\.?0+$/, "")
  return {
    reswellPackageLengthIn: String(nL),
    reswellPackageWidthIn: String(nW),
    reswellPackageHeightIn: String(nH),
    reswellPackageWeightLb: String(lb),
    reswellPackageWeightOz: ozStr,
  }
}

/**
 * True when the seller has configured a shipping path in the sell UI (mode + fields).
 * Matches the intent of {@link validateSellListingForm} shipping checks without requiring
 * the same relaxed/admin branches — used so DB flags stay aligned with visible options.
 */
export function inferSellFormShippingConfigured(fd: SellFulfillmentPersistInput): boolean {
  // Surfboard /sell persists Reswell shipping only.
  const tierId = parseSurfboardShippingTierId(fd.surfboardShippingTier)
  if (!tierId) return false
  if (tierId === "shortboard") {
    return (
      resolveSurfboardShippingPackBandId({
        tierId,
        bandId: fd.surfboardShippingPackBand,
      }) != null
    )
  }
  const L = parseReswellParcelLengthRawToCarrierInches(fd.reswellPackageLengthIn)
  const W = parseReswellParcelWidthHeightRawToCarrierInches(fd.reswellPackageWidthIn)
  const H = parseReswellParcelWidthHeightRawToCarrierInches(fd.reswellPackageHeightIn)
  if (L == null || L <= 0 || W == null || W <= 0 || H == null || H <= 0) return false
  return isReswellPackedWeightComplete(fd.reswellPackageWeightLb, fd.reswellPackageWeightOz)
}

/**
 * Resolves `local_pickup` / `shipping_available` for DB writes from the sell flow.
 * If `boardFulfillment` is out of sync with the shipping section (e.g. draft restore / edge-case state)
 * but the seller has fully configured Reswell shipping, we still set `shipping_available` so `/l`
 * and checkout match what the form shows.
 */
export function resolveListingFulfillmentFlagsForSellSubmit(
  fd: SellFulfillmentPersistInput,
): { local_pickup: boolean; shipping_available: boolean } {
  const mode = normalizeBoardFulfillmentMode(fd.boardFulfillment)
  const base = flagsFromBoardFulfillment(mode)
  const configured = inferSellFormShippingConfigured(fd)
  return {
    local_pickup: base.local_pickup,
    shipping_available: base.shipping_available || configured,
  }
}

/** Maps resolved DB flags back to a {@link BoardFulfillmentChoice} for helpers that take a single mode. */
export function boardFulfillmentChoiceFromListingFlags(flags: {
  local_pickup: boolean
  shipping_available: boolean
}): BoardFulfillmentChoice {
  if (flags.local_pickup && flags.shipping_available) return "pickup_and_shipping"
  if (flags.shipping_available) return "shipping_only"
  return "pickup_only"
}
