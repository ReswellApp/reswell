import {
  fetchShipEngineRatesForSurfboard,
  purchaseShipEngineLabel,
  type ShipEngineRateOption,
} from "@/lib/shipengine/surfboard-label"
import {
  resolvePackedParcelFromListing,
  resolveSurfboardShippingTierIdFromListing,
  suggestPackedBoxInchesFromListing,
  type ListingPackedParcelSource,
  type ResolvedPackedParcelSource,
} from "@/lib/reswell-packed-parcel-from-listing"

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
  SURFBOARD_LABEL_LIMITS_ERROR,
  validateSurfboardLabelParcelLimits,
} from "@/lib/shipping/surfboard-label-limits"
import {
  surfboardShippingTierUsesUpsParcelLimits,
  validateSurfboardShippingTierParcelLimits,
  type SurfboardShippingTierId,
} from "@/lib/surfboard-shipping-tiers"
import { shippingLabelParcelSchema } from "@/lib/validations/order-shipping-label"
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
  const weightLb = Math.max(1, r.weightOz / 16)
  const tierId = resolveSurfboardShippingTierIdFromListing(listing)
  const dims = {
    lengthIn: r.lengthIn,
    widthIn: r.widthIn,
    heightIn: r.heightIn,
    weightLb,
  }

  if (tierId) {
    const tierCheck = validateSurfboardShippingTierParcelLimits(tierId, dims)
    if (!tierCheck.ok) {
      return tierCheck
    }
  }

  if (!tierId || surfboardShippingTierUsesUpsParcelLimits(tierId)) {
    const limitCheck = validateSurfboardLabelParcelLimits(dims)
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
      const limitIssue = checked.error.issues.find(
        (issue) => issue.message === SURFBOARD_LABEL_LIMITS_ERROR,
      )
      if (limitIssue) {
        return { ok: false, error: SURFBOARD_LABEL_LIMITS_ERROR }
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
