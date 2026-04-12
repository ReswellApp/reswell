/**
 * Shared ShipEngine /rates parsing and shipment body construction.
 * Used by the admin rate calculator and public surfboard estimate API.
 */

import { normalizeUsStateProvinceForShipping } from "@/lib/us-state-name-to-code"

export type ShippingAddressInput = {
  name: string
  phone: string
  company_name: string
  address_line1: string
  address_line2: string
  city_locality: string
  state_province: string
  postal_code: string
  country_code: string
  residential: "yes" | "no" | "unknown"
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

/** ShipEngine rejects empty `phone` on `ship_from` / `ship_to` when missing from our UI (rate quotes). */
export const SHIPENGINE_PLACEHOLDER_US_PHONE = "5555555555"

export function addressToPayload(a: ShippingAddressInput, role: "from" | "to") {
  const country = a.country_code.trim().toUpperCase() || "US"
  const phone = a.phone.trim()
  const base: Record<string, unknown> = {
    name: a.name.trim() || (role === "from" ? "Shipper" : "Recipient"),
    phone: phone || SHIPENGINE_PLACEHOLDER_US_PHONE,
    company_name: a.company_name.trim() || undefined,
    address_line1: a.address_line1.trim(),
    address_line2: a.address_line2.trim() || undefined,
    city_locality: a.city_locality.trim(),
    state_province: normalizeUsStateProvinceForShipping(country, a.state_province),
    postal_code: a.postal_code.trim(),
    country_code: country,
    address_residential_indicator: a.residential,
  }
  return base
}

export function buildShipmentBody(
  shipFrom: ShippingAddressInput,
  shipTo: ShippingAddressInput,
  opts: {
    weightValue: number
    weightUnit: "ounce" | "pound" | "gram" | "kilogram"
    length: number
    width: number
    height: number
    dimUnit: "inch" | "centimeter"
    packageCode: string
    validateAddress: "no_validation" | "validate_only" | "validate_and_clean"
  },
) {
  const pkg: Record<string, unknown> = {
    package_code: opts.packageCode || "package",
    weight: { value: opts.weightValue, unit: opts.weightUnit },
  }
  if (opts.length > 0 && opts.width > 0 && opts.height > 0) {
    pkg.dimensions = {
      length: opts.length,
      width: opts.width,
      height: opts.height,
      unit: opts.dimUnit,
    }
  }
  return {
    validate_address: opts.validateAddress,
    ship_from: addressToPayload(shipFrom, "from"),
    ship_to: addressToPayload(shipTo, "to"),
    packages: [pkg],
  }
}

export function extractRatesFromApiEnvelope(envelope: unknown): Record<string, unknown>[] {
  const root = asRecord(envelope)
  const inner = root?.data !== undefined && root?.data !== null ? root.data : envelope
  const se = asRecord(inner)
  const rr = asRecord(se?.rate_response) ?? asRecord(se)
  const rates = rr?.rates
  return Array.isArray(rates) ? (rates as Record<string, unknown>[]) : []
}

export function rateMoneyTotal(r: Record<string, unknown>): { total: number; currency: string } {
  const keys = [
    "shipping_amount",
    "shipment_amount",
    "insurance_amount",
    "confirmation_amount",
    "other_amount",
  ] as const
  let total = 0
  let currency = "usd"
  for (const k of keys) {
    const m = asRecord(r[k])
    if (m && typeof m.amount === "number") {
      total += m.amount
      if (typeof m.currency === "string") currency = m.currency
    }
  }
  return { total, currency }
}

export function extractCarrierIdsFromCarriersResponse(data: unknown): string[] {
  const root = asRecord(data)
  const carriers = root?.carriers
  if (!Array.isArray(carriers)) return []
  const ids: string[] = []
  for (const c of carriers) {
    const row = asRecord(c)
    const id = row?.carrier_id
    if (typeof id === "string" && id.trim()) ids.push(id.trim())
  }
  return ids
}
