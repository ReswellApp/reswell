import type { MobileCategoryListingsQuery } from "@reswell/api-contract"

export type SurfboardLocationFilter = {
  geoBbox?: { lat: number; lng: number; radiusMiles: number }
  locationTextFilter?: string
}

/**
 * Same rule as the website boards browse: a mile radius uses the place's
 * coordinates, and "any distance" matches the city or ZIP text.
 */
export function surfboardLocationFilter(
  query: Pick<MobileCategoryListingsQuery, "location" | "lat" | "lng" | "radius">,
  geocoded: { lat: number; lng: number } | null,
): SurfboardLocationFilter {
  const label = query.location?.trim()
  const radiusMiles = query.radius ? Number(query.radius) : undefined
  const lat = query.lat ?? (radiusMiles != null ? geocoded?.lat : undefined)
  const lng = query.lng ?? (radiusMiles != null ? geocoded?.lng : undefined)
  if (lat != null && lng != null && radiusMiles != null && radiusMiles > 0) {
    return { geoBbox: { lat, lng, radiusMiles } }
  }
  if (label) return { locationTextFilter: label }
  return {}
}

export function surfboardLocationNeedsGeocode(
  query: Pick<MobileCategoryListingsQuery, "location" | "lat" | "lng" | "radius">,
): boolean {
  return Boolean(query.location?.trim() && query.radius && query.lat == null && query.lng == null)
}
