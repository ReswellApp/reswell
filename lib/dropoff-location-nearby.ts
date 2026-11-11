/**
 * Drop-off cities on `/sell` stay hidden until the listing origin (city, ZIP, or pin)
 * is close enough to a pack-and-ship site. Santa Barbara 93101 and Ventura 93001
 * both reach the Santa Barbara drop-off; Los Angeles does not.
 */

/** Crow-flies miles. Ventura is ~29mi from the SB site; LA is ~87mi. */
export const DROPOFF_NEARBY_RADIUS_MILES = 40

export type DropoffNearbyCoords = {
  latitude: number | null
  longitude: number | null
}

export function listingOriginCoords(
  lat: number | null | undefined,
  lng: number | null | undefined,
): { lat: number; lng: number } | null {
  if (lat == null || lng == null) return null
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  if (lat === 0 && lng === 0) return null
  return { lat, lng }
}

export function listingOriginIsSet(
  lat: number | null | undefined,
  lng: number | null | undefined,
): boolean {
  return listingOriginCoords(lat, lng) != null
}

export function parseDropoffNearbyOrigin(
  latRaw: string | null | undefined,
  lngRaw: string | null | undefined,
): { lat: number; lng: number } | null {
  if (latRaw == null || lngRaw == null) return null
  if (latRaw.trim() === "" || lngRaw.trim() === "") return null
  return listingOriginCoords(Number(latRaw), Number(lngRaw))
}

export function milesBetweenDropoffOrigin(
  lat1: number,
  lng1: number,
  lat2: number | null | undefined,
  lng2: number | null | undefined,
): number {
  if (lat2 == null || lng2 == null || !Number.isFinite(lat2) || !Number.isFinite(lng2)) {
    return Infinity
  }
  const R = 3959
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLng = ((lng2 - lng1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

export function dropoffLocationIsNearListing(
  location: DropoffNearbyCoords,
  listingLat: number | null | undefined,
  listingLng: number | null | undefined,
  radiusMiles: number = DROPOFF_NEARBY_RADIUS_MILES,
): boolean {
  const origin = listingOriginCoords(listingLat, listingLng)
  const site = listingOriginCoords(location.latitude, location.longitude)
  if (!origin || !site) return false
  return milesBetweenDropoffOrigin(origin.lat, origin.lng, site.lat, site.lng) <= radiusMiles
}

export function dropoffLocationsNearListing<T extends DropoffNearbyCoords>(
  locations: readonly T[],
  listingLat: number | null | undefined,
  listingLng: number | null | undefined,
  radiusMiles: number = DROPOFF_NEARBY_RADIUS_MILES,
): T[] {
  if (!listingOriginIsSet(listingLat, listingLng)) return []
  return locations.filter((location) =>
    dropoffLocationIsNearListing(location, listingLat, listingLng, radiusMiles),
  )
}

export function sellDropoffSectionVisible(input: {
  listingLat: number | null | undefined
  listingLng: number | null | undefined
  nearbyCount: number
  loadError?: boolean
}): boolean {
  if (!listingOriginIsSet(input.listingLat, input.listingLng)) return false
  if (input.loadError) return true
  return input.nearbyCount > 0
}

/**
 * Drop a saved pack-and-ship choice only when a different origin was already
 * confirmed. An empty loaded key is first load / edit restore — origin pins
 * may still be applying, or the first nearby fetch failed — keep the city.
 */
export function shouldClearDropoffOnNearbyError(input: {
  loadedOriginKey: string
  currentOriginKey: string
}): boolean {
  return input.loadedOriginKey !== "" && input.loadedOriginKey !== input.currentOriginKey
}
