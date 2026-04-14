import type { RateQuoteAddressFields } from "@/lib/shipping/rate-address"

/**
 * Representative continental-US destination for listing-page shipping display quotes.
 * Carriers price primarily on origin/destination ZIP lanes; this is not a buyer address.
 */
export const CONTINENTAL_US_DISPLAY_QUOTE_SHIP_TO: RateQuoteAddressFields = {
  name: "Buyer",
  phone: "5555555555",
  company_name: "",
  address_line1: "1 W 10th St",
  address_line2: "",
  city_locality: "Kansas City",
  state_province: "MO",
  postal_code: "64105",
  country_code: "US",
  residential: "yes",
}
