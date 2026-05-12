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
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim()
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
