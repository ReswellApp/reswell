import type { CoastalCoverageStop, CoastalDashboardJob } from "@/lib/types/coastal-delivery"

export type CoastalMapPin = {
  key: string
  jobId: string
  role: "pickup" | "dropoff"
  latitude: number
  longitude: number
  kind: "house" | "stop"
  focus: boolean
}

export function coastalMapPins(jobs: CoastalDashboardJob[], selectedJobId: string | null): CoastalMapPin[] {
  return jobs.flatMap((job) => {
    const focusRole = job.status === "waiting_for_run" ? "pickup" : "dropoff"
    const pins: CoastalMapPin[] = []
    if (isCoord(job.pickupLatitude) && isCoord(job.pickupLongitude)) {
      pins.push({
        key: `${job.id}:pickup`,
        jobId: job.id,
        role: "pickup",
        latitude: job.pickupLatitude,
        longitude: job.pickupLongitude,
        kind: job.pickupKind,
        focus: job.id === selectedJobId && focusRole === "pickup",
      })
    }
    if (isCoord(job.dropoffLatitude) && isCoord(job.dropoffLongitude)) {
      pins.push({
        key: `${job.id}:dropoff`,
        jobId: job.id,
        role: "dropoff",
        latitude: job.dropoffLatitude,
        longitude: job.dropoffLongitude,
        kind: job.dropoffKind,
        focus: job.id === selectedJobId && focusRole === "dropoff",
      })
    }
    return pins
  })
}

/** Nudge stacked pickup and drop-off pins so both stay tappable. */
export function coastalPinDisplayPoint(pin: CoastalMapPin, pins: CoastalMapPin[]): [number, number] {
  const bucket = pins.filter(
    (other) =>
      Math.abs(other.latitude - pin.latitude) < 0.0008 && Math.abs(other.longitude - pin.longitude) < 0.0008,
  )
  const offset = Math.max(0, bucket.findIndex((other) => other.key === pin.key))
  return [pin.latitude, pin.longitude + offset * 0.012]
}

/** SVG marker for the Maps JavaScript API. Pickup is a circle, drop-off is a rounded square. */
export function coastalPinMarkerIcon(pin: CoastalMapPin, selected: boolean): { url: string; size: number } {
  const size = selected ? 34 : 26
  const fill = pin.kind === "house" ? "#111111" : "#ffffff"
  const color = pin.kind === "house" ? "#ffffff" : "#111111"
  const stroke = selected ? 3 : 2
  const mark = pin.role === "pickup" ? "P" : "D"
  const mid = size / 2
  const shape =
    pin.role === "pickup"
      ? `<circle cx="${mid}" cy="${mid}" r="${mid - stroke}" fill="${fill}" stroke="#111111" stroke-width="${stroke}"/>`
      : `<rect x="${stroke / 2}" y="${stroke / 2}" width="${size - stroke}" height="${size - stroke}" rx="8" fill="${fill}" stroke="#111111" stroke-width="${stroke}"/>`
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${shape}<text x="${mid}" y="${mid}" text-anchor="middle" dominant-baseline="central" fill="${color}" font-family="ui-sans-serif,system-ui,sans-serif" font-size="11" font-weight="600">${mark}</text></svg>`
  return { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`, size }
}

export function coastalCorridorLine(coverage: CoastalCoverageStop[]): [number, number][] {
  if (coverage.length > 1) return coverage.map((stop) => [stop.latitude, stop.longitude])
  if (coverage[0]) return [[coverage[0].latitude, coverage[0].longitude]]
  return []
}

function isCoord(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value)
}
