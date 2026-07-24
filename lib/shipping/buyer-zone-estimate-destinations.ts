/**
 * Representative buyer destinations for each sell-flow calculator zone.
 * Used for live ShipEngine sample quotes — not for purchasing labels.
 */

import type { AddressFields } from "@/app/admin/shipping/address-fields"
import type { ReswellBuyerEstimateZone } from "@/lib/surfboard-shipping-tiers"

function buyerSample(
  address_line1: string,
  city_locality: string,
  state_province: string,
  postal_code: string,
): AddressFields {
  return {
    name: "Buyer",
    phone: "555-0100",
    company_name: "",
    address_line1,
    address_line2: "",
    city_locality,
    state_province,
    postal_code,
    country_code: "US",
    residential: "yes",
  }
}

export type BuyerZoneEstimateDestination = {
  zone: ReswellBuyerEstimateZone
  /** Short city label shown under the live quote */
  sampleCityLabel: string
  shipTo: AddressFields
}

export const BUYER_ZONE_ESTIMATE_DESTINATIONS: Record<
  ReswellBuyerEstimateZone,
  BuyerZoneEstimateDestination
> = {
  california: {
    zone: "california",
    sampleCityLabel: "Los Angeles, CA",
    shipTo: buyerSample("200 N Spring St", "Los Angeles", "CA", "90012"),
  },
  west: {
    zone: "west",
    sampleCityLabel: "Portland, OR",
    shipTo: buyerSample("1221 SW 4th Ave", "Portland", "OR", "97204"),
  },
  rest_of_us: {
    zone: "rest_of_us",
    sampleCityLabel: "New York, NY",
    shipTo: buyerSample("350 5th Ave", "New York", "NY", "10118"),
  },
  hawaii: {
    zone: "hawaii",
    sampleCityLabel: "Honolulu, HI",
    shipTo: buyerSample("530 S King St", "Honolulu", "HI", "96813"),
  },
}

export function getBuyerZoneEstimateDestination(
  zone: ReswellBuyerEstimateZone,
): BuyerZoneEstimateDestination {
  return BUYER_ZONE_ESTIMATE_DESTINATIONS[zone]
}
