import {
  flagsFromBoardFulfillment,
  type BoardFulfillmentChoice,
} from "@/lib/listing-fulfillment"
import type { BoardShippingCostMode } from "@/lib/sell-form-validation"

/**
 * Slice of the surfboard sell form used to persist fulfillment booleans.
 * Kept loose for draft autosave payloads (optional fields).
 */
export type SellFulfillmentPersistInput = {
  boardFulfillment?: BoardFulfillmentChoice | null
  boardShippingCostMode?: BoardShippingCostMode
  boardShippingPrice?: string
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

function parseInchField(raw: string | undefined): number | null {
  const t = raw?.trim() ?? ""
  if (!t) return null
  const n = parseFloat(t.replace(/,/g, ""))
  return Number.isFinite(n) ? n : null
}

/**
 * Persists packed box + weight for Reswell-calculated shipping. Returns `null` when not applicable
 * or when Reswell package fields are incomplete (caller should rely on form validation for UX).
 */
export function reswellPackageFieldsToDb(fd: SellFulfillmentPersistInput): {
  shipping_packed_length_in: number | null
  shipping_packed_width_in: number | null
  shipping_packed_height_in: number | null
  shipping_packed_weight_oz: number | null
} {
  const mode = fd.boardShippingCostMode ?? "reswell"
  if (mode !== "reswell") {
    return {
      shipping_packed_length_in: null,
      shipping_packed_width_in: null,
      shipping_packed_height_in: null,
      shipping_packed_weight_oz: null,
    }
  }
  const L = parseInchField(fd.reswellPackageLengthIn)
  const W = parseInchField(fd.reswellPackageWidthIn)
  const H = parseInchField(fd.reswellPackageHeightIn)
  const lbRaw = fd.reswellPackageWeightLb?.trim() ?? ""
  const ozRaw = fd.reswellPackageWeightOz?.trim() ?? ""
  const lb = lbRaw === "" ? 0 : parseFloat(lbRaw.replace(/,/g, ""))
  const oz = ozRaw === "" ? 0 : parseFloat(ozRaw.replace(/,/g, ""))
  if (
    L == null ||
    L <= 0 ||
    W == null ||
    W <= 0 ||
    H == null ||
    H <= 0 ||
    !Number.isFinite(lb) ||
    lb < 0 ||
    !Number.isFinite(oz) ||
    oz < 0 ||
    oz >= 16
  ) {
    return {
      shipping_packed_length_in: null,
      shipping_packed_width_in: null,
      shipping_packed_height_in: null,
      shipping_packed_weight_oz: null,
    }
  }
  const totalOz = lb * 16 + oz
  if (!Number.isFinite(totalOz) || totalOz <= 0) {
    return {
      shipping_packed_length_in: null,
      shipping_packed_width_in: null,
      shipping_packed_height_in: null,
      shipping_packed_weight_oz: null,
    }
  }
  return {
    shipping_packed_length_in: L,
    shipping_packed_width_in: W,
    shipping_packed_height_in: H,
    shipping_packed_weight_oz: totalOz,
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
  if (L == null || L === "" || W == null || W === "" || H == null || H === "" || ozTotal == null || ozTotal === "") {
    return empty
  }
  const nL = typeof L === "number" ? L : parseFloat(String(L).replace(/,/g, ""))
  const nW = typeof W === "number" ? W : parseFloat(String(W).replace(/,/g, ""))
  const nH = typeof H === "number" ? H : parseFloat(String(H).replace(/,/g, ""))
  const totalOz = typeof ozTotal === "number" ? ozTotal : parseFloat(String(ozTotal).replace(/,/g, ""))
  if (!Number.isFinite(nL) || !Number.isFinite(nW) || !Number.isFinite(nH) || !Number.isFinite(totalOz)) {
    return empty
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
  const mode = fd.boardShippingCostMode ?? "reswell"
  if (mode === "free") return true
  if (mode === "flat") {
    const raw = fd.boardShippingPrice?.trim() ?? ""
    if (!raw) return false
    const n = parseFloat(raw.replace(/,/g, ""))
    return Number.isFinite(n) && n >= 0
  }
  const L = parseInchField(fd.reswellPackageLengthIn)
  const W = parseInchField(fd.reswellPackageWidthIn)
  const H = parseInchField(fd.reswellPackageHeightIn)
  if (L == null || L <= 0 || W == null || W <= 0 || H == null || H <= 0) return false
  const lbRaw = fd.reswellPackageWeightLb?.trim() ?? ""
  const ozRaw = fd.reswellPackageWeightOz?.trim() ?? ""
  const lb = lbRaw === "" ? 0 : parseFloat(lbRaw.replace(/,/g, ""))
  const oz = ozRaw === "" ? 0 : parseFloat(ozRaw.replace(/,/g, ""))
  if (!Number.isFinite(lb) || lb < 0 || !Number.isFinite(oz) || oz < 0 || oz >= 16) return false
  const totalOz = lb * 16 + oz
  return Number.isFinite(totalOz) && totalOz > 0
}

/**
 * Resolves `local_pickup` / `shipping_available` for DB writes from the sell flow.
 * If `boardFulfillment` is out of sync with the shipping section (e.g. draft restore / edge-case state)
 * but the seller has fully configured shipping (Reswell dims, flat rate, or free), we still set
 * `shipping_available` so `/l` and checkout match what the form shows.
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
