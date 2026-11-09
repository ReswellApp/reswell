import { googleForwardGeocode } from "@/lib/maps/google-geocoding-server"
import type { OrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"

export const TRACKING_ACTIVITY_PREVIEW_COUNT = 3

export type TrackingEventPlace = {
  city_locality?: string | null
  state_province?: string | null
  postal_code?: string | null
  latitude?: number | null
  longitude?: number | null
}

export type TrackingMapPoint = {
  latitude: number
  longitude: number
  label: string
}

export function formatTrackingEventLocation(event: TrackingEventPlace): string | null {
  const cityState = [event.city_locality, event.state_province].filter(Boolean).join(", ")
  const postal = event.postal_code?.trim()
  if (cityState && postal) return `${cityState} ${postal}`
  if (cityState) return cityState
  if (postal) return postal
  return null
}

export function formatTrackingEventCityState(event: TrackingEventPlace): string | null {
  const cityState = [event.city_locality?.trim(), event.state_province?.trim()].filter(Boolean).join(", ")
  return cityState || null
}

function validCoord(lat: number | null | undefined, lng: number | null | undefined): boolean {
  return (
    typeof lat === "number" &&
    typeof lng === "number" &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  )
}

function pointKey(lat: number, lng: number): string {
  return `${lat.toFixed(3)},${lng.toFixed(3)}`
}

function placeKey(event: TrackingEventPlace): string | null {
  const city = event.city_locality?.trim().toLowerCase() ?? ""
  const state = event.state_province?.trim().toLowerCase() ?? ""
  const postal = event.postal_code?.trim().toLowerCase() ?? ""
  const key = [city, state, postal].filter(Boolean).join("|")
  return key || null
}

/** Unique scan stops, oldest first, for a route polyline. Events are newest-first. */
export function trackingMapPointsFromEvents(
  events: readonly TrackingEventPlace[] | null | undefined,
): TrackingMapPoint[] {
  const chronological = [...(events ?? [])].reverse()
  const points: TrackingMapPoint[] = []
  const seen = new Set<string>()
  for (const event of chronological) {
    if (!validCoord(event.latitude, event.longitude)) continue
    const lat = event.latitude as number
    const lng = event.longitude as number
    const key = pointKey(lat, lng)
    if (seen.has(key)) continue
    seen.add(key)
    points.push({
      latitude: lat,
      longitude: lng,
      label: formatTrackingEventCityState(event) ?? formatTrackingEventLocation(event) ?? "Scan",
    })
  }
  return points
}

export function trackingMapSummary(points: readonly TrackingMapPoint[]): string | null {
  if (points.length === 0) return null
  const start = points[0]?.label?.trim()
  const end = points[points.length - 1]?.label?.trim()
  if (!start) return null
  if (!end || end === start) return start
  return `${start} → ${end}`
}

export function trackingMapDirectionsUrl(points: readonly TrackingMapPoint[]): string | null {
  if (points.length === 0) return null
  const start = points[0]
  const end = points[points.length - 1]
  if (!start) return null
  if (!end || points.length === 1) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${start.latitude},${start.longitude}`)}`
  }
  const origin = `${start.latitude},${start.longitude}`
  const destination = `${end.latitude},${end.longitude}`
  return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(destination)}`
}

const geocodeCache = new Map<string, { lat: number; lng: number } | null>()

async function geocodePlace(query: string): Promise<{ lat: number; lng: number } | null> {
  const key = query.trim().toLowerCase()
  if (!key) return null
  if (geocodeCache.has(key)) return geocodeCache.get(key) ?? null
  const result = await googleForwardGeocode(query)
  const coords = result ? { lat: result.lat, lng: result.lng } : null
  geocodeCache.set(key, coords)
  return coords
}

function eventWithCoords(
  event: NonNullable<OrderTrackingDetail["events"]>[number],
  lat: number,
  lng: number,
): NonNullable<OrderTrackingDetail["events"]>[number] {
  return { ...event, latitude: lat, longitude: lng }
}

/** Fill missing event coordinates from city/state so older snapshots can still plot. */
export async function withTrackingEventCoordinates(
  detail: OrderTrackingDetail | null,
): Promise<OrderTrackingDetail | null> {
  if (!detail?.events?.length) return detail
  const events = detail.events
  const queryByPlace = new Map<string, string>()
  for (const event of events) {
    if (validCoord(event.latitude, event.longitude)) continue
    const key = placeKey(event)
    const query = formatTrackingEventLocation(event) ?? formatTrackingEventCityState(event)
    if (!key || !query || queryByPlace.has(key)) continue
    queryByPlace.set(key, query)
  }

  const resolved = new Map<string, { lat: number; lng: number }>()
  await Promise.all(
    [...queryByPlace.entries()].map(async ([key, query]) => {
      const coords = await geocodePlace(query)
      if (coords) resolved.set(key, coords)
    }),
  )
  if (resolved.size === 0) return detail

  return {
    ...detail,
    events: events.map((event) => {
      if (validCoord(event.latitude, event.longitude)) return event
      const key = placeKey(event)
      const coords = key ? resolved.get(key) : undefined
      return coords ? eventWithCoords(event, coords.lat, coords.lng) : event
    }),
  }
}
