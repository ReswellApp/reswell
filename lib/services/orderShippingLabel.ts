import {
  fetchShipEngineRatesForSurfboard,
  purchaseShipEngineLabel,
  type ShipEngineRateOption,
} from "@/lib/shipengine/surfboard-label"
import {
  orderShippingJsonToRateQuoteAddress,
  profileRowToRateQuoteAddress,
  type RateQuoteAddressFields,
} from "@/lib/shipping/rate-address"
import type { ProfileAddressRow } from "@/lib/profile-address"

export type { ShipEngineRateOption }

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
