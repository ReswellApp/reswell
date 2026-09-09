import type { AddressFields } from "@/app/admin/shipping/address-fields"
import { lookupUsZipViaNominatim } from "@/lib/geocode/us-zip-lookup"
import { getGoogleGeocodingApiKey, googleGeocodeUsZip } from "@/lib/maps/google-geocoding-server"

function shipFromAddress(input: {
  address_line1?: string
  city_locality: string
  state_province: string
  postal_code: string
}): AddressFields {
  return {
    name: "Seller",
    phone: "",
    company_name: "",
    address_line1: input.address_line1 ?? "100 Main St",
    address_line2: "",
    city_locality: input.city_locality,
    state_province: input.state_province,
    postal_code: input.postal_code,
    country_code: "US",
    residential: "no",
  }
}

/** Resolve a 5-digit US ZIP to a ship-from address for sample rate shopping. */
export async function resolveUsZipShipFrom(zip: string): Promise<AddressFields | null> {
  const five = zip.replace(/\D/g, "").slice(0, 5)
  if (five.length !== 5) return null

  const nominatim = await lookupUsZipViaNominatim(five)
  if (nominatim?.city_locality && nominatim.state_province && nominatim.postal_code) {
    return shipFromAddress(nominatim)
  }

  if (getGoogleGeocodingApiKey()) {
    const g = await googleGeocodeUsZip(five)
    if (g) return shipFromAddress(g)
  }

  return null
}
