import { normalizeCountryCodeForShipping } from "../shipping/normalize-country-code.ts"
import { normalizeUsStateProvinceForShipping } from "../us-state-name-to-code.ts"

export type AddressResidentialIndicator = "yes" | "no" | "unknown"

export type ShipEngineMatchedAddress = {
  name: string
  phone: string
  company_name: string
  address_line1: string
  address_line2: string
  city_locality: string
  state_province: string
  postal_code: string
  country_code: string
  residential: AddressResidentialIndicator
}

export type ShipEngineAddressValidationStatus = "verified" | "unverified" | "warning" | "error"

export type ParsedShipEngineAddressValidation = {
  status: ShipEngineAddressValidationStatus
  messages: string[]
  matched: ShipEngineMatchedAddress | null
}

function asRecord(v: unknown): Record<string, unknown> | null {
  return v != null && typeof v === "object" && !Array.isArray(v)
    ? (v as Record<string, unknown>)
    : null
}

export function parseResidentialIndicator(value: unknown): AddressResidentialIndicator {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : ""
  if (raw === "yes" || raw === "no" || raw === "unknown") return raw
  return "unknown"
}

export function parseShipEngineAddressValidationStatus(
  value: unknown,
): ShipEngineAddressValidationStatus {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : ""
  if (raw === "verified" || raw === "unverified" || raw === "warning" || raw === "error") {
    return raw
  }
  return "error"
}

function readMessage(entry: unknown): string | null {
  if (typeof entry === "string") {
    const trimmed = entry.trim()
    return trimmed || null
  }
  const rec = asRecord(entry)
  if (!rec) return null
  for (const key of ["message", "detail", "reason"] as const) {
    const value = rec[key]
    if (typeof value === "string" && value.trim()) return value.trim()
  }
  return null
}

export function parseShipEngineMatchedAddress(
  raw: unknown,
): ShipEngineMatchedAddress | null {
  const rec = asRecord(raw)
  if (!rec) return null
  const address_line1 =
    typeof rec.address_line1 === "string" ? rec.address_line1.trim() : ""
  const city_locality =
    typeof rec.city_locality === "string" ? rec.city_locality.trim() : ""
  const postal_code = typeof rec.postal_code === "string" ? rec.postal_code.trim() : ""
  if (!address_line1 || !city_locality || !postal_code) return null

  const country_code = normalizeCountryCodeForShipping(
    typeof rec.country_code === "string" ? rec.country_code : "US",
  )
  const stateRaw = typeof rec.state_province === "string" ? rec.state_province : ""

  return {
    name: typeof rec.name === "string" ? rec.name.trim() : "",
    phone: typeof rec.phone === "string" ? rec.phone.trim() : "",
    company_name: typeof rec.company_name === "string" ? rec.company_name.trim() : "",
    address_line1,
    address_line2: typeof rec.address_line2 === "string" ? rec.address_line2.trim() : "",
    city_locality,
    state_province: normalizeUsStateProvinceForShipping(country_code, stateRaw),
    postal_code,
    country_code,
    residential: parseResidentialIndicator(rec.address_residential_indicator),
  }
}

export function parseShipEngineAddressValidation(
  data: unknown,
): ParsedShipEngineAddressValidation {
  const row = Array.isArray(data) ? data[0] : data
  const rec = asRecord(row)
  if (!rec) {
    return { status: "error", messages: [], matched: null }
  }

  const messages: string[] = []
  if (Array.isArray(rec.messages)) {
    for (const entry of rec.messages) {
      const message = readMessage(entry)
      if (message) messages.push(message)
    }
  }

  return {
    status: parseShipEngineAddressValidationStatus(rec.status),
    messages,
    matched: parseShipEngineMatchedAddress(rec.matched_address),
  }
}

export function shipEngineAddressValidationIsAcceptable(
  validation: ParsedShipEngineAddressValidation,
): boolean {
  return (
    (validation.status === "verified" || validation.status === "warning") &&
    validation.matched != null
  )
}

export function formatShipEngineAddressValidationError(
  validation: ParsedShipEngineAddressValidation,
): string {
  const first = validation.messages[0]
  if (first) return first
  if (validation.status === "unverified") {
    return "UPS, FedEx, and USPS could not verify this address. Check the street, city, and ZIP."
  }
  return "This address is not valid for shipping. Check the street, city, and ZIP."
}
