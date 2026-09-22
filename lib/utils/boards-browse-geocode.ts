import type { BoardsBrowseSearchParams } from "@/lib/marketplace-slug-metadata"

/** URL precision (~1.1 m). Stable enough to reuse across filter navigations. */
export const BOARDS_BROWSE_GEO_COORD_DECIMALS = 5

export function normalizeForwardGeocodePlaceKey(place: string): string {
  return place.trim().toLowerCase().replace(/\s+/g, " ")
}

export function parseBoardsBrowseCoord(raw: string | undefined | null): number | undefined {
  if (raw == null) return undefined
  const t = raw.trim()
  if (!t) return undefined
  const n = Number(t)
  if (!Number.isFinite(n)) return undefined
  return n
}

export function isValidBoardsBrowseLatLng(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
}

export function formatBoardsBrowseCoord(n: number): string {
  return n.toFixed(BOARDS_BROWSE_GEO_COORD_DECIMALS)
}

export function boardsBrowseHasLatLng(
  latRaw: string | undefined | null,
  lngRaw: string | undefined | null,
): boolean {
  const lat = parseBoardsBrowseCoord(latRaw)
  const lng = parseBoardsBrowseCoord(lngRaw)
  return lat != null && lng != null && isValidBoardsBrowseLatLng(lat, lng)
}

/** True when a place string is present but the URL has no usable lat/lng yet. */
export function boardsBrowseNeedsGeocodePersist(
  searchParams: Pick<BoardsBrowseSearchParams, "location" | "lat" | "lng">,
): boolean {
  const location = searchParams.location?.trim() ?? ""
  if (location.length < 2) return false
  return !boardsBrowseHasLatLng(searchParams.lat, searchParams.lng)
}

export function boardsBrowsePathWithSearchParams(
  browsePath: string,
  params: URLSearchParams,
): string {
  const qs = params.toString()
  return qs ? `${browsePath}?${qs}` : browsePath
}

export function boardsBrowseSearchParamsToURLSearchParams(
  searchParams: BoardsBrowseSearchParams,
  omitKeys?: ReadonlySet<string>,
): URLSearchParams {
  const next = new URLSearchParams()
  for (const [k, v] of Object.entries(searchParams)) {
    if (v == null || v === "") continue
    if (omitKeys?.has(k)) continue
    next.set(k, v)
  }
  return next
}

/** Copy browse params and write a geocoded anchor (replaces any stale lat/lng). */
export function boardsBrowseSearchParamsWithGeocode(
  searchParams: BoardsBrowseSearchParams,
  geo: { lat: number; lng: number },
): URLSearchParams {
  const next = boardsBrowseSearchParamsToURLSearchParams(
    searchParams,
    new Set(["lat", "lng"]),
  )
  next.set("lat", formatBoardsBrowseCoord(geo.lat))
  next.set("lng", formatBoardsBrowseCoord(geo.lng))
  return next
}
