import type { AddressFields } from "@/app/admin/shipping/address-fields"

/**
 * Representative US destinations for surfboard rate shopping (generic street + real ZIP).
 * Carriers price primarily on ZIP lanes; not for purchasing labels.
 */

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

export const SAMPLE_DESTINATION_PRESETS: {
  id: string
  label: string
  description: string
  shipTo: AddressFields
}[] = [
  {
    id: "ca",
    label: "California",
    description: "Los Angeles",
    shipTo: buyerSample("200 N Spring St", "Los Angeles", "CA", "90012"),
  },
  {
    id: "east",
    label: "East Coast",
    description: "New York City",
    shipTo: buyerSample("350 5th Ave", "New York", "NY", "10118"),
  },
  {
    id: "fl",
    label: "Florida",
    description: "Miami",
    shipTo: buyerSample("200 Biscayne Blvd", "Miami", "FL", "33132"),
  },
  {
    id: "nj",
    label: "New Jersey",
    description: "Newark",
    shipTo: buyerSample("1 Newark Center", "Newark", "NJ", "07102"),
  },
  {
    id: "tx",
    label: "Texas",
    description: "Austin",
    shipTo: buyerSample("700 Congress Ave", "Austin", "TX", "78701"),
  },
]
