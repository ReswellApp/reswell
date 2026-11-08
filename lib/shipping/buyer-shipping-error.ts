import type { ShipEngineInvalidRateSummary } from "./shipengine-rate-helpers.ts"
import {
  peerCheckoutShippingServiceError,
  type PeerCheckoutRateFamily,
  type PeerCheckoutShipTo,
} from "./peer-checkout-usps-services.ts"

const PO_BOX_BUYER_ERROR =
  "UPS and FedEx cannot deliver to a PO Box. Enter a street address, or choose pickup if it is available."

const ADDRESS_BUYER_ERROR =
  "Carriers could not quote shipping to this address. Check the street, city, and ZIP, then try again."

const ORIGIN_BUYER_ERROR =
  "The seller's ship-from address could not be quoted. Contact support."

const PARCEL_BUYER_ERROR =
  "This package size or weight cannot be shipped with the available carriers. Try a different address or contact support."

const LANE_BUYER_ERROR =
  "No carrier service is available between the seller and this address. Try a different address or contact support."

const TEMP_BUYER_ERROR =
  "Shipping is temporarily unavailable. Try again in a few minutes or contact support."

const CHECKOUT_FALLBACK_ERROR =
  "Could not get shipping rates for this address. Try again or contact support."

const LABEL_FALLBACK_ERROR =
  "Could not get shipping rates for this label. Check the addresses and box size, or contact support."

const LABEL_PURCHASE_FALLBACK_ERROR =
  "Could not purchase this shipping label. Check the addresses and box size, then try again."

/** Map a carrier / ShipEngine sentence to copy a buyer or seller can act on. Never pass the raw string through. */
export function mapCarrierTextToPublicReason(text: string | null | undefined): string | null {
  const t = (text ?? "").trim().toLowerCase()
  if (!t) return null

  if (/p\.?\s*o\.?\s*box|post office box/.test(t)) return PO_BOX_BUYER_ERROR
  if (/insufficient funds|insufficient balance/.test(t)) return TEMP_BUYER_ERROR
  if (
    /exceeds maximum|too large|too heavy|girth|maximum for this service|package dimensions|weight exceeds|dimensional weight|length plus girth/.test(
      t,
    )
  ) {
    return PARCEL_BUYER_ERROR
  }
  if (/(origin|ship.?from|shipper address)/.test(t) && /not valid|invalid|cannot/.test(t)) {
    return ORIGIN_BUYER_ERROR
  }
  if (
    /not valid for this service|invalid destination|address is not valid|recipient address|unverified address/.test(
      t,
    )
  ) {
    return ADDRESS_BUYER_ERROR
  }
  if (/not available for the given origin|service is not available|does not serve this|lane is not/.test(t)) {
    return LANE_BUYER_ERROR
  }
  return null
}

function firstMappedReason(texts: Array<string | null | undefined>): string | null {
  for (const text of texts) {
    const mapped = mapCarrierTextToPublicReason(text)
    if (mapped) return mapped
  }
  return null
}

function looksLikeRawCarrierDump(text: string): boolean {
  const t = text.trim()
  if (!t) return true
  if (t.startsWith("{") || t.startsWith("[")) return true
  if (/error_code|carrier_id|rate_id|invalid_rates|shipengine/i.test(t)) return true
  if (/^[a-z][a-z0-9_]+: /i.test(t)) return true
  return false
}

export function publicFacingShippingFailure(input: {
  invalidRates?: ShipEngineInvalidRateSummary[] | null
  apiError?: string | null
  fallback: string
}): string {
  const mapped = firstMappedReason([
    ...(input.invalidRates ?? []).map((row) => row.message),
    input.apiError,
  ])
  if (mapped) return mapped
  const api = input.apiError?.trim()
  if (api && !looksLikeRawCarrierDump(api)) return api
  return input.fallback
}

/** Checkout quote 422 — family fallback plus carrier invalid_rates when we have them. */
export function buyerFacingCheckoutShippingError(input: {
  section?: string | null
  shipTo?: PeerCheckoutShipTo | null
  rateFamily?: PeerCheckoutRateFamily | null
  invalidRates?: ShipEngineInvalidRateSummary[] | null
  apiError?: string | null
}): string {
  const fallback =
    peerCheckoutShippingServiceError(input.section, input.shipTo, input.rateFamily) ||
    CHECKOUT_FALLBACK_ERROR
  const api = input.apiError?.trim()
  if (api && /choose another rate/i.test(api)) return api
  if (/PO Box/.test(fallback)) return fallback
  return publicFacingShippingFailure({
    invalidRates: input.invalidRates,
    apiError: input.apiError,
    fallback,
  })
}

export function sellerFacingLabelRateError(input: {
  invalidRates?: ShipEngineInvalidRateSummary[] | null
  apiError?: string | null
  fallback?: string
}): string {
  return publicFacingShippingFailure({
    invalidRates: input.invalidRates,
    apiError: input.apiError,
    fallback: input.fallback?.trim() || LABEL_FALLBACK_ERROR,
  })
}

export function sellerFacingLabelPurchaseError(input: {
  apiError?: string | null
  fallback?: string
}): string {
  return publicFacingShippingFailure({
    apiError: input.apiError,
    fallback: input.fallback?.trim() || LABEL_PURCHASE_FALLBACK_ERROR,
  })
}
