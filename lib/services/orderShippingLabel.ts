import {
  fetchShipEngineRatesForSurfboard,
  purchaseShipEngineLabel,
  type ShipEngineRateOption,
} from "@/lib/shipengine/surfboard-label"
import {
  listingUsesAdminCustomSurfboardCarton,
  resolveCombinedPackedParcelFromListings,
  resolvePackedParcelFromListing,
  resolveSurfboardShippingTierIdFromListing,
  suggestPackedBoxInchesFromListing,
  type ListingPackedParcelSource,
  type ResolvedPackedParcelSource,
} from "@/lib/reswell-packed-parcel-from-listing"
import {
  isMultiSurfboardOneBoxShipment,
  validateMultiSurfboardOneBoxParcel,
} from "@/lib/surfboard-multi-board-parcel"

/** Seller flat/free labels: never auto-quote from listing volume heuristics — seller must enter parcel. */
export const SELLER_LABEL_REQUIRES_PACKED_PARCEL_ERROR =
  "Enter the packed box dimensions and weight to get a carrier quote. The buyer's prepaid flat shipping is credited toward the label cost."
import {
  orderShippingJsonToRateQuoteAddress,
  profileRowToRateQuoteAddress,
  type RateQuoteAddressFields,
} from "@/lib/shipping/rate-address"
import type { ProfileAddressRow } from "@/lib/profile-address"
import {
  LABEL_PARCEL_MIN_WEIGHT_LB,
  SURFBOARD_LABEL_LIMITS_ERROR,
  validateLabelParcelEntry,
  validateSurfboardLabelParcelLimits,
} from "@/lib/shipping/surfboard-label-limits"
import {
  surfboardShippingTierUsesUpsParcelLimits,
  validateSurfboardShippingTierParcelLimits,
  type SurfboardShippingTierId,
} from "@/lib/surfboard-shipping-tiers"
import { logPackBandLabelTelemetry } from "@/lib/shipping/pack-band-telemetry"

export type { ShipEngineRateOption }

export type ResolvedOrderLabelParcel = {
  lengthIn: number
  widthIn: number
  heightIn: number
  weightLb: number
  source: ResolvedPackedParcelSource
  tierId: SurfboardShippingTierId | null
}

/**
 * Parcel for ShipEngine labels from the sold listing (same resolution as checkout quotes).
 */
export function resolveOrderLabelParcelFromListing(
  listing: ListingPackedParcelSource,
): { ok: true; parcel: ResolvedOrderLabelParcel } | { ok: false; error: string } {
  const r = resolvePackedParcelFromListing(listing)
  if (!r.ok) {
    return { ok: false, error: r.error }
  }
  const weightLb = Math.max(LABEL_PARCEL_MIN_WEIGHT_LB, r.weightOz / 16)
  const tierId = resolveSurfboardShippingTierIdFromListing(listing)
  const dims = {
    lengthIn: r.lengthIn,
    widthIn: r.widthIn,
    heightIn: r.heightIn,
    weightLb,
  }

  if (tierId) {
    const tierCheck = validateSurfboardShippingTierParcelLimits(tierId, dims, {
      adminCustomCarton: listingUsesAdminCustomSurfboardCarton(listing),
    })
    if (!tierCheck.ok) {
      return tierCheck
    }
    // Mid/long freight: tier ceilings only. Shortboard / UPS parcel: full UPS caps.
    if (surfboardShippingTierUsesUpsParcelLimits(tierId)) {
      const limitCheck = validateSurfboardLabelParcelLimits(dims)
      if (!limitCheck.ok) {
        return limitCheck
      }
    }
  } else {
    // Non-surfboard / untiered: generalized manual parcel entry limits (main).
    const limitCheck = validateLabelParcelEntry(dims)
    if (!limitCheck.ok) {
      if (limitCheck.error === SURFBOARD_LABEL_LIMITS_ERROR) {
        return limitCheck
      }
      return {
        ok: false,
        error:
          "Package details from this listing don’t meet carrier limits. Update shipping dimensions on the listing, or adjust the package below.",
      }
    }
  }

  logPackBandLabelTelemetry({
    listingId:
      listing && "id" in listing ? String((listing as { id?: string }).id ?? "") : null,
    tierId,
    bandId: listing.shipping_package_band,
    dims: {
      lengthIn: r.lengthIn,
      widthIn: r.widthIn,
      heightIn: r.heightIn,
      weightLb,
    },
  })

  return {
    ok: true,
    parcel: {
      lengthIn: r.lengthIn,
      widthIn: r.widthIn,
      heightIn: r.heightIn,
      weightLb,
      source: r.source,
      tierId,
    },
  }
}

/**
 * One-box label parcel for a same-seller order. Multi-surfboard orders use
 * longest board + 4″ × 27 × 7 (same as checkout quotes).
 */
export function resolveOrderLabelParcelFromListings(
  listings: ListingPackedParcelSource[],
): { ok: true; parcel: ResolvedOrderLabelParcel } | { ok: false; error: string } {
  if (listings.length === 0) {
    return { ok: false, error: "No listings to size a shipping label for." }
  }
  if (listings.length === 1) {
    return resolveOrderLabelParcelFromListing(listings[0]!)
  }

  const r = resolveCombinedPackedParcelFromListings(listings)
  if (!r.ok) {
    return { ok: false, error: r.error }
  }

  const weightLb = Math.max(LABEL_PARCEL_MIN_WEIGHT_LB, r.weightOz / 16)
  const dims = {
    lengthIn: r.lengthIn,
    widthIn: r.widthIn,
    heightIn: r.heightIn,
    weightLb,
  }

  if (isMultiSurfboardOneBoxShipment(listings)) {
    const multiCheck = validateMultiSurfboardOneBoxParcel(dims)
    if (!multiCheck.ok) {
      return multiCheck
    }
  } else {
    const limitCheck = validateLabelParcelEntry(dims)
    if (!limitCheck.ok) {
      return limitCheck
    }
  }

  const firstSurfboard = listings.find((row) => resolveSurfboardShippingTierIdFromListing(row) != null)
  const tierId = firstSurfboard ? resolveSurfboardShippingTierIdFromListing(firstSurfboard) : null

  logPackBandLabelTelemetry({
    listingId:
      firstSurfboard && "id" in firstSurfboard
        ? String((firstSurfboard as { id?: string }).id ?? "")
        : null,
    tierId,
    bandId: firstSurfboard?.shipping_package_band,
    dims,
  })

  return {
    ok: true,
    parcel: {
      lengthIn: r.lengthIn,
      widthIn: r.widthIn,
      heightIn: r.heightIn,
      weightLb,
      source: r.source,
      tierId,
    },
  }
}

/**
 * Optional L×W×H prefill for seller flat/free label forms (board dims floored to whole inches).
 * Weight is never inferred — sellers must measure and enter it.
 */
export function suggestSellerLabelParcelDimsFromListing(
  listing: ListingPackedParcelSource,
): { lengthIn: number; widthIn: number; heightIn: number } | null {
  return suggestPackedBoxInchesFromListing(listing)
}

export async function fetchRatesForSurfboardOrder(params: {
  shipFrom: RateQuoteAddressFields
  shipTo: RateQuoteAddressFields
  parcel: { lengthIn: number; widthIn: number; heightIn: number; weightLb: number }
  tierId?: SurfboardShippingTierId | null
  adminCustomCarton?: boolean
  listingSection?: string | null
}) {
  return fetchShipEngineRatesForSurfboard(params)
}

/**
 * Low-level ShipEngine buy. For marketplace orders always use
 * {@link purchaseShipEngineLabelForOrderOnce} so an order cannot be charged twice.
 */
export async function purchaseLabelWithRateId(rateId: string) {
  return purchaseShipEngineLabel(rateId)
}

export function resolveAddressesForLabel(params: {
  sellerAddress: ProfileAddressRow
  orderShippingJson: unknown
}): { ok: true; from: RateQuoteAddressFields; to: RateQuoteAddressFields } | { ok: false; error: string } {
  const from = profileRowToRateQuoteAddress(params.sellerAddress)
  const to = orderShippingJsonToRateQuoteAddress(params.orderShippingJson)
  if (!to) {
    return { ok: false, error: "This order does not have a complete buyer shipping address." }
  }
  return { ok: true, from, to }
}

/**
 * Return label: buyer ships back to the seller's ship-from address.
 * `from` = buyer order shipping address, `to` = seller profile address.
 */
export function resolveAddressesForReturnLabel(params: {
  sellerAddress: ProfileAddressRow
  orderShippingJson: unknown
}): { ok: true; from: RateQuoteAddressFields; to: RateQuoteAddressFields } | { ok: false; error: string } {
  const from = orderShippingJsonToRateQuoteAddress(params.orderShippingJson)
  if (!from) {
    return { ok: false, error: "This order does not have a complete buyer shipping address for the return." }
  }
  const to = profileRowToRateQuoteAddress(params.sellerAddress)
  if (!to.name?.trim() || !to.address_line1?.trim() || !to.city_locality?.trim() || !to.state_province?.trim()) {
    return { ok: false, error: "Seller ship-from address is incomplete." }
  }
  return { ok: true, from, to }
}
