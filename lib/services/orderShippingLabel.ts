import {
  fetchShipEngineRatesForSurfboard,
  purchaseShipEngineLabel,
  type ShipEngineRateOption,
} from "@/lib/shipengine/surfboard-label"
import {
  resolvePackedParcelFromListing,
  type ListingPackedParcelSource,
  type ResolvedPackedParcelSource,
} from "@/lib/reswell-packed-parcel-from-listing"
import {
  orderShippingJsonToRateQuoteAddress,
  profileRowToRateQuoteAddress,
  type RateQuoteAddressFields,
} from "@/lib/shipping/rate-address"
import type { ProfileAddressRow } from "@/lib/profile-address"
import {
  SURFBOARD_LABEL_LIMITS_ERROR,
  validateSurfboardLabelParcelLimits,
} from "@/lib/shipping/surfboard-label-limits"
import { shippingLabelParcelSchema } from "@/lib/validations/order-shipping-label"

export type { ShipEngineRateOption }

export type ResolvedOrderLabelParcel = {
  lengthIn: number
  widthIn: number
  heightIn: number
  weightLb: number
  source: ResolvedPackedParcelSource
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
  const weightLb = Math.max(1, r.weightOz / 16)
  const limitCheck = validateSurfboardLabelParcelLimits({
    lengthIn: r.lengthIn,
    widthIn: r.widthIn,
    heightIn: r.heightIn,
    weightLb,
  })
  if (!limitCheck.ok) {
    return limitCheck
  }

  const checked = shippingLabelParcelSchema.safeParse({
    length_in: r.lengthIn,
    width_in: r.widthIn,
    height_in: r.heightIn,
    weight_lb: weightLb,
  })
  if (!checked.success) {
    const limitIssue = checked.error.issues.find((issue) => issue.message === SURFBOARD_LABEL_LIMITS_ERROR)
    if (limitIssue) {
      return { ok: false, error: SURFBOARD_LABEL_LIMITS_ERROR }
    }
    return {
      ok: false,
      error:
        "Package details from this listing don’t meet carrier limits. Update shipping dimensions on the listing, or adjust the package below.",
    }
  }
  return {
    ok: true,
    parcel: {
      lengthIn: r.lengthIn,
      widthIn: r.widthIn,
      heightIn: r.heightIn,
      weightLb,
      source: r.source,
    },
  }
}

export async function fetchRatesForSurfboardOrder(params: {
  shipFrom: RateQuoteAddressFields
  shipTo: RateQuoteAddressFields
  parcel: { lengthIn: number; widthIn: number; heightIn: number; weightLb: number }
}) {
  return fetchShipEngineRatesForSurfboard(params)
}

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
