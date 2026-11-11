import { googleForwardGeocode } from "@/lib/maps/google-geocoding-server"
import { redisGetOrSet } from "@/lib/redis/cache"
import { REDIS_TTL_SECONDS, redisForwardGeocodeKey } from "@/lib/redis/keys"
import type { OrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import {
  formatTrackingEventCityState,
  formatTrackingEventLocation,
  trackingEventPlaceKey,
  validCoord,
} from "@/lib/shipping/tracking-map-points"

const geocodeCache = new Map<string, { lat: number; lng: number } | null>()

async function geocodePlace(query: string): Promise<{ lat: number; lng: number } | null> {
  const key = query.trim().toLowerCase()
  if (!key) return null
  if (geocodeCache.has(key)) return geocodeCache.get(key) ?? null
  const coords = await redisGetOrSet(redisForwardGeocodeKey(key), REDIS_TTL_SECONDS.forwardGeocode, async () => {
    const result = await googleForwardGeocode(query)
    return result ? { lat: result.lat, lng: result.lng } : null
  })
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
    const key = trackingEventPlaceKey(event)
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
      const key = trackingEventPlaceKey(event)
      const coords = key ? resolved.get(key) : undefined
      return coords ? eventWithCoords(event, coords.lat, coords.lng) : event
    }),
  }
}
