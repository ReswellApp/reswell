import type { ProfileAddressRow } from "../profile-address.ts"
import type {
  AddressResidentialIndicator,
  ParsedShipEngineAddressValidation,
  ShipEngineMatchedAddress,
} from "../shipengine/validate-address-parse.ts"
import { normalizeCountryCodeForShipping } from "./normalize-country-code.ts"
import {
  isUspsStateProvinceCode,
  normalizeUsStateProvinceForShipping,
} from "../us-state-name-to-code.ts"
import {
  peerCheckoutAllowsPoBoxDestination,
  UPS_FEDEX_PO_BOX_ERROR,
} from "./peer-checkout-usps-services.ts"
import { addressRowLooksLikeUsPoBox } from "./us-po-box.ts"

export const BUYER_ADDRESS_VALIDATION_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

export type BuyerAddressCarrierFields = {
  line1: string
  line2: string | null
  city: string
  state: string | null
  postal_code: string
  country: string
  residential: AddressResidentialIndicator
}

/** Explicit ShipEngine values win; missing legacy rows default to residential. */
export function buyerResidentialIndicator(
  value: ProfileAddressRow["residential"] | string | null | undefined,
  fallback: AddressResidentialIndicator = "yes",
): AddressResidentialIndicator {
  const raw = typeof value === "string" ? value.trim().toLowerCase() : ""
  if (raw === "yes" || raw === "no" || raw === "unknown") return raw
  return fallback
}

export function isBuyerAddressValidationFresh(
  validatedAt: string | null | undefined,
  nowMs = Date.now(),
): boolean {
  if (!validatedAt) return false
  const parsed = Date.parse(validatedAt)
  if (!Number.isFinite(parsed)) return false
  return nowMs - parsed < BUYER_ADDRESS_VALIDATION_MAX_AGE_MS
}

export function matchedAddressToBuyerFields(
  matched: ShipEngineMatchedAddress,
): BuyerAddressCarrierFields {
  return {
    line1: matched.address_line1,
    line2: matched.address_line2 || null,
    city: matched.city_locality,
    state: matched.state_province || null,
    postal_code: matched.postal_code,
    country: matched.country_code || "US",
    residential: matched.residential,
  }
}

/** US ZIP or ZIP+4. Returns a carrier-friendly postal string, or null. */
export function normalizeUsPostalCodeForShipping(raw: string | null | undefined): string | null {
  const digits = (raw ?? "").replace(/\D/g, "")
  if (digits.length === 5) return digits
  if (digits.length === 9) return `${digits.slice(0, 5)}-${digits.slice(5)}`
  return null
}

export type LocalBuyerAddressFieldsResult =
  | { ok: true; fields: BuyerAddressCarrierFields }
  | { ok: false; error: string }

/**
 * Structural US shipping check — street, city, USPS state, ZIP.
 * Used when carriers do not confirm the address so checkout can still proceed.
 */
export function localBuyerAddressFieldsFromInput(input: {
  line1?: string | null
  line2?: string | null
  city?: string | null
  state?: string | null
  postal_code?: string | null
  country?: string | null
  residential?: AddressResidentialIndicator | string | null
}): LocalBuyerAddressFieldsResult {
  const country = normalizeCountryCodeForShipping(input.country)
  if (country !== "US") {
    return { ok: false, error: "Only US shipping addresses are supported." }
  }

  const line1 = input.line1?.trim() ?? ""
  const city = input.city?.trim() ?? ""
  if (!line1 || !city) {
    return { ok: false, error: "Street and city are required." }
  }

  const state = normalizeUsStateProvinceForShipping(country, input.state ?? "")
  if (!isUspsStateProvinceCode(state)) {
    return { ok: false, error: "Add a valid US state." }
  }

  const postal_code = normalizeUsPostalCodeForShipping(input.postal_code)
  if (!postal_code) {
    return { ok: false, error: "Enter a valid US ZIP code." }
  }

  return {
    ok: true,
    fields: {
      line1,
      line2: input.line2?.trim() || null,
      city,
      state,
      postal_code,
      country,
      residential: buyerResidentialIndicator(input.residential, "unknown"),
    },
  }
}

/**
 * Prefer the carrier-standardized match when ShipEngine returns one (any status).
 * Otherwise keep the complete US address the buyer entered.
 */
export function buyerAddressFieldsFromCarrierOrLocal(
  validation: ParsedShipEngineAddressValidation | null,
  local: BuyerAddressCarrierFields,
): BuyerAddressCarrierFields {
  if (validation?.matched) {
    return matchedAddressToBuyerFields(validation.matched)
  }
  return local
}

export function checkoutPoBoxErrorForSections(
  address: { line1?: string | null; line2?: string | null },
  sections: Array<string | null | undefined>,
): string | null {
  if (!addressRowLooksLikeUsPoBox(address)) return null
  if (peerCheckoutAllowsPoBoxDestination(sections)) return null
  return UPS_FEDEX_PO_BOX_ERROR
}

