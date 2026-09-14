/**
 * Public listing location derived from a saved street address.
 * City + state only — never street, ZIP, or apartment.
 * Display line matches `listingShipFromDisplayLine` (city, state).
 */
export type ListingLocalityFromAddress = {
  city: string
  state: string
  lat: number | null
  lng: number | null
  displayName: string
}

export type AddressLocalityFields = {
  city: string
  state?: string | null
}

/** City/state line buyers may see. Drops street even if a caller passes extra fields. */
export function listingLocalityFromAddress(
  addr: AddressLocalityFields,
  pin?: { lat?: number | null; lng?: number | null },
): ListingLocalityFromAddress | null {
  const city = addr.city.trim()
  if (!city) return null
  const state = (addr.state ?? "").trim()
  const lat =
    pin?.lat != null && Number.isFinite(pin.lat) && pin.lat !== 0 ? pin.lat : null
  const lng =
    pin?.lng != null && Number.isFinite(pin.lng) && pin.lng !== 0 ? pin.lng : null
  return {
    city,
    state,
    lat,
    lng,
    displayName: state ? `${city}, ${state}` : city,
  }
}

export function listingLocalityHasPin(
  loc: Pick<ListingLocalityFromAddress, "lat" | "lng">,
): boolean {
  return loc.lat != null && loc.lng != null && loc.lat !== 0 && loc.lng !== 0
}

/** Form fields for LocationPicker — city/state only, never street. */
export function listingLocationFormPatch(loc: ListingLocalityFromAddress): {
  locationCity: string
  locationState: string
  locationDisplay: string
  locationLat: number | null
  locationLng: number | null
} {
  return {
    locationCity: loc.city,
    locationState: loc.state,
    locationDisplay: loc.displayName,
    locationLat: loc.lat,
    locationLng: loc.lng,
  }
}
