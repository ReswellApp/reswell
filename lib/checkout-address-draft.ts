import type { ShippingAddressFormInput } from "@/lib/address-input"
import { normalizeCountryCodeForShipping } from "@/lib/shipping/normalize-country-code"

const US_POSTAL_CODE = /^\d{5}(?:-\d{4})?$/

/** Stable identity for a checkout address draft, used to avoid duplicate saves. */
export function checkoutAddressDraftFingerprint(draft: ShippingAddressFormInput): string {
  const country = normalizeCountryCodeForShipping(draft.country || "US")
  return [
    draft.line1.trim().toLowerCase(),
    (draft.line2 ?? "").trim().toLowerCase(),
    draft.city.trim().toLowerCase(),
    (draft.state ?? "").trim().toLowerCase(),
    draft.postal_code.trim(),
    country,
  ].join("\n")
}

/**
 * True when the draft is complete enough to persist and quote.
 * US ZIP is required so a half-typed postal code does not create an address.
 */
export function isCheckoutAddressDraftReadyToSave(draft: ShippingAddressFormInput): boolean {
  const country = normalizeCountryCodeForShipping(draft.country || "US")
  if (country !== "US") return false
  return (
    draft.line1.trim().length > 0 &&
    draft.city.trim().length > 0 &&
    (draft.state ?? "").trim().length >= 2 &&
    US_POSTAL_CODE.test(draft.postal_code.trim())
  )
}
