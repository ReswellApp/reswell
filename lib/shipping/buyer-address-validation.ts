import type { ProfileAddressRow } from "../profile-address.ts"
import type {
  AddressResidentialIndicator,
  ShipEngineMatchedAddress,
} from "../shipengine/validate-address-parse.ts"
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

export function checkoutPoBoxErrorForSections(
  address: { line1?: string | null; line2?: string | null },
  sections: Array<string | null | undefined>,
): string | null {
  if (!addressRowLooksLikeUsPoBox(address)) return null
  if (peerCheckoutAllowsPoBoxDestination(sections)) return null
  return UPS_FEDEX_PO_BOX_ERROR
}

