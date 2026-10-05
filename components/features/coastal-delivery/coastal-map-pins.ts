import type { CoastalCoverageStop, CoastalDashboardJob } from "@/lib/types/coastal-delivery"

type PinIconApi = {
  divIcon: (options: {
    html: string
    className: string
    iconSize: [number, number]
    iconAnchor: [number, number]
  }) => unknown
}

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

export function coastalPinHtml(pin: CoastalMapPin, size: number, selected: boolean): string {
  const radius = pin.role === "pickup" ? "50%" : "8px"
  const fill = pin.kind === "house" ? "#111111" : "#ffffff"
  const color = pin.kind === "house" ? "#ffffff" : "#111111"
  const border = selected ? "3px solid #111111" : "2px solid #111111"
  const mark = pin.role === "pickup" ? "P" : "D"
  return `<div style="width:${size}px;height:${size}px;border-radius:${radius};background:${fill};color:${color};border:${border};box-shadow:0 2px 8px rgba(0,0,0,0.28);display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:600;line-height:1;">${mark}</div>`
}

export function coastalPinIcon(leaflet: PinIconApi, pin: CoastalMapPin, selected: boolean) {
  const size = selected ? 34 : 26
  return leaflet.divIcon({
    html: coastalPinHtml(pin, size, selected),
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  })
}

export function coastalCorridorLine(coverage: CoastalCoverageStop[]): [number, number][] {
  if (coverage.length > 1) return coverage.map((stop) => [stop.latitude, stop.longitude])
  if (coverage[0]) return [[coverage[0].latitude, coverage[0].longitude]]
  return []
}

function isCoord(value: number | null): value is number {
  return typeof value === "number" && Number.isFinite(value)
}
