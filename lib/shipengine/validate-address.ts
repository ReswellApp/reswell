import { shipEngineRequest } from "@/lib/shipengine/client"
import { isShipEngineConfigured } from "@/lib/shipengine/config"
import { formatShipEngineApiError } from "@/lib/shipengine/errors"
import { normalizeCountryCodeForShipping } from "@/lib/shipping/normalize-country-code"
import { normalizeUsStateProvinceForShipping } from "@/lib/us-state-name-to-code"
import {
  parseShipEngineAddressValidation,
  type ParsedShipEngineAddressValidation,
} from "@/lib/shipengine/validate-address-parse"

export type {
  AddressResidentialIndicator,
  ParsedShipEngineAddressValidation,
  ShipEngineAddressValidationStatus,
  ShipEngineMatchedAddress,
} from "@/lib/shipengine/validate-address-parse"
export {
  formatShipEngineAddressValidationError,
  parseResidentialIndicator,
  parseShipEngineAddressValidation,
  parseShipEngineAddressValidationStatus,
  parseShipEngineMatchedAddress,
  shipEngineAddressValidationIsAcceptable,
} from "@/lib/shipengine/validate-address-parse"

export type ShipEngineAddressToValidate = {
  name?: string | null
  phone?: string | null
  company_name?: string | null
  address_line1: string
  address_line2?: string | null
  city_locality: string
  state_province: string
  postal_code: string
  country_code: string
}

export type ValidateShipEngineAddressResult =
  | { ok: true; validation: ParsedShipEngineAddressValidation }
  | { ok: false; unavailable: true; error: string }
  | { ok: false; unavailable: false; error: string }

function toValidatePayload(input: ShipEngineAddressToValidate): Record<string, unknown> {
  const country = normalizeCountryCodeForShipping(input.country_code)
  return {
    name: input.name?.trim() || undefined,
    phone: input.phone?.trim() || undefined,
    company_name: input.company_name?.trim() || undefined,
    address_line1: input.address_line1.trim(),
    address_line2: input.address_line2?.trim() || undefined,
    city_locality: input.city_locality.trim(),
    state_province: normalizeUsStateProvinceForShipping(country, input.state_province),
    postal_code: input.postal_code.trim(),
    country_code: country,
  }
}

async function parseJsonSafe(res: Response): Promise<unknown> {
  const text = await res.text()
  if (!text) return null
  try {
    return JSON.parse(text) as unknown
  } catch {
    return text
  }
}

/** ShipEngine `/addresses/validate` — carrier-standardized street + residential type. */
export async function validateShipEngineAddress(
  input: ShipEngineAddressToValidate,
): Promise<ValidateShipEngineAddressResult> {
  if (!isShipEngineConfigured()) {
    return {
      ok: false,
      unavailable: true,
      error: "Address verification is temporarily unavailable.",
    }
  }

  let res: Response
  try {
    res = await shipEngineRequest("/addresses/validate", {
      method: "POST",
      body: JSON.stringify([toValidatePayload(input)]),
    })
  } catch (error) {
    console.error("[validateShipEngineAddress] request failed:", error)
    return {
      ok: false,
      unavailable: true,
      error: "Could not reach address verification. Try again in a moment.",
    }
  }

  const data = await parseJsonSafe(res)
  if (!res.ok) {
    const hint = formatShipEngineApiError(data)
    return {
      ok: false,
      unavailable: res.status >= 500,
      error: hint || "Could not verify this address with UPS, FedEx, or USPS.",
    }
  }

  const validation = parseShipEngineAddressValidation(data)
  return { ok: true, validation }
}

