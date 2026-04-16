/// <reference types="google.maps" />

/**
 * Maps Google Places `address_components` to ShipEngine-style shipping fields.
 */
export type ParsedGoogleShippingAddress = {
  line1: string
  line2: string
  city: string
  state: string
  postal_code: string
  country: string
}

export function parseGoogleAddressComponents(
  components: google.maps.GeocoderAddressComponent[],
): ParsedGoogleShippingAddress {
  const get = (type: string, short = false) => {
    const c = components.find((x) => x.types.includes(type))
    if (!c) return ""
    return short ? c.short_name : c.long_name
  }

  const streetNumber = get("street_number")
  const route = get("route")
  const line1 = [streetNumber, route].filter(Boolean).join(" ").trim()

  const subpremise = get("subpremise")
  const premise = get("premise")
  const line2 = [subpremise, premise].filter(Boolean).join(" ").trim()

  const city =
    get("locality") ||
    get("sublocality") ||
    get("neighborhood") ||
    get("administrative_area_level_3") ||
    ""

  const state = get("administrative_area_level_1", true)
  const postal_code = get("postal_code")
  let country = get("country", true).toUpperCase().slice(0, 2)
  if (!country) country = "US"

  return { line1, line2, city, state, postal_code, country }
}
