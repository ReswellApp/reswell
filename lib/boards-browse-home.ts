import { normalizeBoardBrowseRadius } from "@/lib/boards-browse-location"
import { parseBoardsBrowseCoord } from "@/lib/utils/boards-browse-geocode"

/** Query flag for the signed-in home-area preference on `/boards`. */
export const BOARDS_BROWSE_HOME_PARAM = "home"
/** Home geo is a ranking preference (nearby first), not a hard radius cutoff. */
export const BOARDS_BROWSE_HOME_ON = "1"
/** User dismissed home geo for this browse session — do not re-apply it. */
export const BOARDS_BROWSE_HOME_OFF = "off"

/** Default nearby-priority bucket when a location is set without a radius. */
export const BOARDS_BROWSE_NEARBY_PRIORITY_DEFAULT_MI = 100

/** Explicit sorts that should not be overridden by nearby-first ranking. */
const SKIP_NEARBY_PRIORITY_SORTS = new Set([
  "nearest",
  "price-low",
  "price-high",
  "price-newest",
])

const METERS_PER_MILE = 1609.344
/** ~15 m — formatted vs raw profile coords should still match. */
const HOME_COORD_MATCH_EPSILON = 0.00015

export function isBoardsBrowseHomeDismissed(
  home: string | undefined | null,
): boolean {
  return home?.trim().toLowerCase() === BOARDS_BROWSE_HOME_OFF
}

export function isBoardsBrowseHomePreference(
  home: string | undefined | null,
): boolean {
  const v = home?.trim().toLowerCase()
  return v === BOARDS_BROWSE_HOME_ON || v === "true"
}

/** Persist a session opt-out so profile home is not merged back onto the URL. */
export function markBoardsBrowseHomeDismissed(params: URLSearchParams): void {
  params.set(BOARDS_BROWSE_HOME_PARAM, BOARDS_BROWSE_HOME_OFF)
}

export function clearBoardsBrowseGeoParams(params: URLSearchParams): void {
  params.delete("location")
  params.delete("lat")
  params.delete("lng")
  params.delete("radius")
}

/** Hard radius cutoff: user chose a distance, not the home ranking preference. */
export function boardsBrowseUsesHardRadius(sp: {
  home?: string | null
  radius?: string | null
}): boolean {
  if (isBoardsBrowseHomePreference(sp.home)) return false
  return normalizeBoardBrowseRadius(sp.radius ?? null) !== "any"
}

/**
 * Nearby-first bucket size (miles). `null` when location should not affect ranking
 * (no coords, explicit nearest sort, or a hard radius filter).
 */
export function boardsBrowseNearbyPriorityMiles(sp: {
  home?: string | null
  radius?: string | null
  hasLatLng: boolean
  sort: string
}): number | null {
  if (!sp.hasLatLng) return null
  if (SKIP_NEARBY_PRIORITY_SORTS.has(sp.sort)) return null
  if (boardsBrowseUsesHardRadius(sp)) return null
  const radius = normalizeBoardBrowseRadius(sp.radius ?? null)
  if (radius !== "any") return Number(radius)
  return BOARDS_BROWSE_NEARBY_PRIORITY_DEFAULT_MI
}

export function boardsBrowseHomeCoordsMatch(
  latRaw: string | undefined | null,
  lngRaw: string | undefined | null,
  home: { lat: number | null; lng: number | null },
): boolean {
  if (home.lat == null || home.lng == null) return false
  const lat = parseBoardsBrowseCoord(latRaw)
  const lng = parseBoardsBrowseCoord(lngRaw)
  if (lat == null || lng == null) return false
  return (
    Math.abs(lat - home.lat) <= HOME_COORD_MATCH_EPSILON &&
    Math.abs(lng - home.lng) <= HOME_COORD_MATCH_EPSILON
  )
}

export function nearbyPriorityBucket(distanceMi: number, radiusMi: number): 0 | 1 {
  if (!Number.isFinite(distanceMi) || distanceMi > radiusMi) return 1
  return 0
}

/** ES sort clause: listings inside `radiusMi` before the rest. Missing geo sorts last. */
export function boardsBrowseEsNearbyPrioritySortClause(
  lat: number,
  lng: number,
  radiusMi: number,
): object {
  return {
    _script: {
      type: "number",
      script: {
        lang: "painless",
        source:
          "if (!doc.containsKey('location') || doc['location'].size() == 0) return 1; return doc['location'].arcDistance(params.lat, params.lon) <= params.radiusMeters ? 0 : 1;",
        params: {
          lat,
          lon: lng,
          radiusMeters: radiusMi * METERS_PER_MILE,
        },
      },
      order: "asc",
    },
  }
}
