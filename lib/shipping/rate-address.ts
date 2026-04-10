import { normalizeUsStateProvinceForShipping } from "@/lib/us-state-name-to-code"
import type { ProfileAddressRow } from "@/lib/profile-address"

/** Same shape as admin `AddressFields` — ShipEngine rate/label APIs expect this structure. */
export type RateQuoteAddressFields = {
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

export function profileRowToRateQuoteAddress(row: ProfileAddressRow): RateQuoteAddressFields {
  return {
    name: row.full_name.trim() || "Seller",
    phone: row.phone?.trim() ?? "",
    company_name: "",
    address_line1: row.line1.trim(),
    address_line2: row.line2?.trim() ?? "",
    city_locality: row.city.trim(),
    state_province: row.state?.trim() ?? "",
    postal_code: row.postal_code.trim(),
    country_code: row.country.trim().toUpperCase() || "US",
    residential: "yes",
  }
}

export function orderShippingJsonToRateQuoteAddress(ship: unknown): RateQuoteAddressFields | null {
  const s =
    ship != null && typeof ship === "object" && !Array.isArray(ship)
      ? (ship as Record<string, unknown>)
      : null
  if (!s) return null
  const addrRaw = s.address
  const a =
    addrRaw != null && typeof addrRaw === "object" && !Array.isArray(addrRaw)
      ? (addrRaw as Record<string, unknown>)
      : null
  if (!a) return null
  const line1 = typeof a.line1 === "string" ? a.line1.trim() : ""
  const city = typeof a.city === "string" ? a.city.trim() : ""
  const postal = typeof a.postal_code === "string" ? a.postal_code.trim() : ""
  if (!line1 || !city || !postal) return null
  const country = (typeof a.country === "string" ? a.country.trim() : "") || "US"
  const nm = typeof s.name === "string" ? s.name.trim() : ""
  const ph = typeof s.phone === "string" ? s.phone.trim() : ""
  const line2 = typeof a.line2 === "string" ? a.line2.trim() : ""
  const st = typeof a.state === "string" ? a.state.trim() : ""
  return {
    name: nm || "Recipient",
    phone: ph,
    company_name: "",
    address_line1: line1,
    address_line2: line2,
    city_locality: city,
    state_province: st,
    postal_code: postal,
    country_code: country.toUpperCase(),
    residential: "yes",
  }
}

export function addressToShipEnginePayload(a: RateQuoteAddressFields, role: "from" | "to") {
  const country = a.country_code.trim().toUpperCase() || "US"
  const base: Record<string, unknown> = {
    name: a.name.trim() || (role === "from" ? "Shipper" : "Recipient"),
    phone: a.phone.trim() || undefined,
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

export function buildShipEngineRateShipment(
  shipFrom: RateQuoteAddressFields,
  shipTo: RateQuoteAddressFields,
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
    ship_from: addressToShipEnginePayload(shipFrom, "from"),
    ship_to: addressToShipEnginePayload(shipTo, "to"),
    packages: [pkg],
  }
}
