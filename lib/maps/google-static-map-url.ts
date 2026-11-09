import type { TrackingMapPoint } from "@/lib/shipping/tracking-map-points"

function mapsStaticApiKey(): string | null {
  return process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() || null
}

/**
 * Optional Maps Static API URL (same browser key as Maps JS / Places). Enable **Maps Static API** if you use this.
 */
export function googleStaticMapPreviewUrl(opts: {
  latitude: number
  longitude: number
  /** CSS pixels approx (next/image sizing); API uses logical size × scale where applicable */
  width: number
  height: number
  scale?: 1 | 2
}): string | null {
  const key = mapsStaticApiKey()
  if (!key) return null

  const { latitude, longitude, width, height, scale = 2 } = opts
  const clampedW = Math.min(640, Math.max(80, Math.round(width)))
  const clampedH = Math.min(640, Math.max(80, Math.round(height)))

  const params = new URLSearchParams({
    center: `${latitude},${longitude}`,
    zoom: "16",
    size: `${clampedW}x${clampedH}`,
    scale: String(scale),
    markers: `color:0xEA4335|${latitude},${longitude}`,
    key,
  })

  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
}

export function googleMapsSearchUrl(latitude: number, longitude: number): string {
  const q = `${latitude},${longitude}`
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

/** Route preview used on mobile Track package. Same scan coordinates as the ShipEngine map. */
export function googleStaticMapRouteUrl(
  points: readonly TrackingMapPoint[],
  opts?: { width?: number; height?: number; scale?: 1 | 2 },
): string | null {
  const key = mapsStaticApiKey()
  if (!key || points.length === 0) return null

  const width = Math.min(640, Math.max(160, Math.round(opts?.width ?? 640)))
  const height = Math.min(640, Math.max(120, Math.round(opts?.height ?? 280)))
  const scale = opts?.scale ?? 2
  const start = points[0]
  const end = points[points.length - 1]
  if (!start || !end) return null

  const params = new URLSearchParams({
    size: `${width}x${height}`,
    scale: String(scale),
    maptype: "roadmap",
    key,
  })
  if (points.length === 1) {
    params.set("center", `${start.latitude},${start.longitude}`)
    params.set("zoom", "8")
    params.append("markers", `color:0x355185|${start.latitude},${start.longitude}`)
  } else {
    params.append("markers", `color:0x04070E|size:small|${start.latitude},${start.longitude}`)
    params.append("markers", `color:0x355185|${end.latitude},${end.longitude}`)
    params.append(
      "path",
      `color:0x355185ff|weight:4|${points.map((point) => `${point.latitude},${point.longitude}`).join("|")}`,
    )
  }
  return `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`
}
