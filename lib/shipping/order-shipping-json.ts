import type { RateQuoteAddressFields } from "@/lib/shipping/rate-address"

/**
 * Write a label ship-to back onto `orders.shipping_address`.
 * Keeps buyer email and any other keys already stored on the order.
 */
export function applyRateQuoteAddressToOrderShippingJson(
  existing: unknown,
  shipTo: RateQuoteAddressFields,
): Record<string, unknown> {
  const base =
    existing != null && typeof existing === "object" && !Array.isArray(existing)
      ? { ...(existing as Record<string, unknown>) }
      : {}
  const existingAddr =
    base.address != null && typeof base.address === "object" && !Array.isArray(base.address)
      ? { ...(base.address as Record<string, unknown>) }
      : {}
  const company = shipTo.company_name.trim()
  return {
    ...base,
    name: shipTo.name.trim(),
    phone: shipTo.phone.trim() || null,
    company_name: company || null,
    address: {
      ...existingAddr,
      line1: shipTo.address_line1.trim(),
      line2: shipTo.address_line2.trim() || null,
      city: shipTo.city_locality.trim(),
      state: shipTo.state_province.trim(),
      postal_code: shipTo.postal_code.trim(),
      country: shipTo.country_code.trim() || "US",
      residential: shipTo.residential,
    },
  }
}
