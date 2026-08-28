import type { RateQuoteAddressFields } from "@/lib/shipping/rate-address"

/**
 * Reswell HQ / returns warehouse (Santa Barbara).
 * Used as ship-to for buyer return labels and as ship-from for Reswell outbound labels.
 */
export const RESWELL_WAREHOUSE_ADDRESS: RateQuoteAddressFields = {
  name: "Reswell",
  phone: "",
  company_name: "Reswell",
  address_line1: "915 De La Vina",
  address_line2: "",
  city_locality: "Santa Barbara",
  state_province: "CA",
  postal_code: "93101",
  country_code: "US",
  residential: "no",
}

export function getReswellWarehouseAddress(): RateQuoteAddressFields {
  return { ...RESWELL_WAREHOUSE_ADDRESS }
}
