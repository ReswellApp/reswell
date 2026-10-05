import {
  coastalDirectionLabel,
  formatCoastalRunWhen,
  pacificWeekDateIso,
} from "@/lib/services/coastalDeliveryMatch"
import type {
  CoastalAddressSnapshot,
  CoastalCoverageStop,
  CoastalDashboardJob,
  CoastalDeliveryStatus,
  CoastalDirection,
  CoastalPlaceKind,
  CoastalRunSheetSection,
  CoastalRunView,
  CoastalStopView,
} from "@/lib/types/coastal-delivery"

/** Corridor pins used when a stop row has no coordinates yet. */
export const COASTAL_STOP_FALLBACK_COORDINATES: Record<string, { latitude: number; longitude: number }> = {
  capitola: { latitude: 36.971, longitude: -121.9533 },
  "santa-cruz": { latitude: 36.9647, longitude: -122.0016 },
  "half-moon-bay": { latitude: 37.4636, longitude: -122.4286 },
  pacifica: { latitude: 37.6138, longitude: -122.495 },
  "san-francisco": { latitude: 37.7594, longitude: -122.5107 },
  bolinas: { latitude: 37.9094, longitude: -122.6864 },
  "bodega-bay": { latitude: 38.3332, longitude: -123.0486 },
}

export type CoastalJobDraft = {
  id: string
  listingId: string
  listingTitle: string
  saleLabel: string
  buyerName: string | null
  sellerName: string
  sellerOriginLabel: string
  status: CoastalDeliveryStatus
  matchedRunId: string | null
  pickupStopId: string
  dropoffStopId: string
  pickupSnapshot: CoastalAddressSnapshot | null
  dropoffSnapshot: CoastalAddressSnapshot | null
  salePlaced: boolean
  statusActionsEnabled: boolean
}

export function stopCoordinates(stop: CoastalStopView | undefined): { latitude: number; longitude: number } | null {
  if (!stop) return null
  if (isCoord(stop.latitude) && isCoord(stop.longitude)) {
    return { latitude: stop.latitude, longitude: stop.longitude }
  }
  return COASTAL_STOP_FALLBACK_COORDINATES[stop.slug] ?? null
}

export function nextHandoffCopy(status: CoastalDeliveryStatus, pickupLabel: string, dropoffLabel: string): string {
  if (status === "waiting_for_run") return `Pick up at ${pickupLabel}`
  if (status === "picked_up") return `Drop off at ${dropoffLabel}`
  return "Dropped off"
}

export function buildCoastalRunSheet(input: {
  now: Date
  runs: CoastalRunView[]
  stops: CoastalStopView[]
  jobs: CoastalJobDraft[]
}): {
  weekLabel: string
  coverage: CoastalCoverageStop[]
  sections: CoastalRunSheetSection[]
  jobs: CoastalDashboardJob[]
} {
  const stopsById = new Map(input.stops.map((stop) => [stop.id, stop]))
  const jobs = input.jobs.map((job) => toDashboardJob(job, stopsById))
  const runs = [...input.runs].sort((a, b) => {
    const byDay = a.dayOfWeek - b.dayOfWeek
    if (byDay !== 0) return byDay
    if (a.direction !== b.direction) return a.direction === "northbound" ? -1 : 1
    return a.id.localeCompare(b.id)
  })

  const sections: CoastalRunSheetSection[] = runs.map((run) => {
    const dateIso = pacificWeekDateIso(input.now, run.dayOfWeek)
    const runJobs = sortJobsForDrive(
      jobs.filter((job) => job.matchedRunId === run.id),
      input.stops,
      run.direction,
    )
    return {
      key: run.id,
      title: `${formatCoastalRunWhen(run.dayOfWeek, dateIso)} · ${coastalDirectionLabel(run.direction)}`,
      subtitle: run.enabled ? "Run is on" : "Run is off",
      runId: run.id,
      enabled: run.enabled,
      jobs: runJobs,
    }
  })

  const scheduled = new Set(runs.map((run) => run.id))
  const unscheduled = jobs
    .filter((job) => !job.matchedRunId || !scheduled.has(job.matchedRunId))
    .sort((a, b) => a.listingTitle.localeCompare(b.listingTitle) || a.id.localeCompare(b.id))
  if (unscheduled.length > 0) {
    sections.push({
      key: "unscheduled",
      title: "Not on a run this week",
      subtitle: "Assigned to you without a matching run.",
      runId: null,
      enabled: true,
      jobs: unscheduled,
    })
  }

  return {
    weekLabel: weekLabel(input.now),
    coverage: coverageStops(runs, input.stops),
    sections,
    jobs,
  }
}

function toDashboardJob(job: CoastalJobDraft, stopsById: Map<string, CoastalStopView>): CoastalDashboardJob {
  const pickup = resolvePlace(stopsById.get(job.pickupStopId), job.pickupSnapshot, job.salePlaced)
  const dropoff = resolvePlace(stopsById.get(job.dropoffStopId), job.dropoffSnapshot, job.salePlaced)
  return {
    id: job.id,
    listingId: job.listingId,
    listingTitle: job.listingTitle,
    saleLabel: job.saleLabel,
    buyerName: job.buyerName,
    sellerName: job.sellerName,
    sellerOriginLabel: job.sellerOriginLabel,
    status: job.status,
    matchedRunId: job.matchedRunId,
    pickupStopId: job.pickupStopId,
    dropoffStopId: job.dropoffStopId,
    pickupLabel: pickup.label,
    dropoffLabel: dropoff.label,
    pickupStopName: pickup.stopName,
    dropoffStopName: dropoff.stopName,
    pickupKind: pickup.kind,
    dropoffKind: dropoff.kind,
    pickupLatitude: pickup.latitude,
    pickupLongitude: pickup.longitude,
    dropoffLatitude: dropoff.latitude,
    dropoffLongitude: dropoff.longitude,
    nextHandoff: nextHandoffCopy(job.status, pickup.label, dropoff.label),
    statusActionsEnabled: job.statusActionsEnabled,
  }
}

function resolvePlace(
  stop: CoastalStopView | undefined,
  snapshot: CoastalAddressSnapshot | null,
  salePlaced: boolean,
): {
  label: string
  stopName: string
  kind: CoastalPlaceKind
  latitude: number | null
  longitude: number | null
} {
  const stopPoint = stopCoordinates(stop)
  const stopName = stop?.name ?? "Corridor stop"
  const houseText = salePlaced && snapshot?.label ? snapshot.label : null
  if (
    salePlaced &&
    snapshot &&
    isCoord(snapshot.latitude) &&
    isCoord(snapshot.longitude)
  ) {
    return {
      label: houseText ?? stopName,
      stopName,
      kind: "house",
      latitude: snapshot.latitude,
      longitude: snapshot.longitude,
    }
  }
  return {
    label: houseText ?? stopName,
    stopName,
    kind: "stop",
    latitude: stopPoint?.latitude ?? null,
    longitude: stopPoint?.longitude ?? null,
  }
}

function sortJobsForDrive(
  jobs: CoastalDashboardJob[],
  stops: CoastalStopView[],
  direction: CoastalDirection,
): CoastalDashboardJob[] {
  const sortById = new Map(stops.map((stop) => [stop.id, stop.sortOrder]))
  return [...jobs].sort((a, b) => {
    const done = (job: CoastalDashboardJob) => (job.status === "dropped_off" ? 1 : 0)
    const byDone = done(a) - done(b)
    if (byDone !== 0) return byDone
    const directed = (job: CoastalDashboardJob) => {
      const stopId = job.status === "waiting_for_run" ? job.pickupStopId : job.dropoffStopId
      const sort = sortById.get(stopId) ?? 0
      return direction === "southbound" ? -sort : sort
    }
    const byStop = directed(a) - directed(b)
    if (byStop !== 0) return byStop
    return a.listingTitle.localeCompare(b.listingTitle) || a.id.localeCompare(b.id)
  })
}

function coverageStops(runs: CoastalRunView[], stops: CoastalStopView[]): CoastalCoverageStop[] {
  const enabledIds = new Set(runs.filter((run) => run.enabled).flatMap((run) => run.stopIds))
  return stops
    .filter((stop) => enabledIds.has(stop.id))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
    .flatMap((stop) => {
      const point = stopCoordinates(stop)
      if (!point) return []
      return [{ id: stop.id, name: stop.name, sortOrder: stop.sortOrder, ...point }]
    })
}

function weekLabel(now: Date): string {
  const sunday = pacificWeekDateIso(now, 0)
  const saturday = pacificWeekDateIso(now, 6)
  return `Week of ${monthDay(sunday)}–${monthDay(saturday)}`
}

function monthDay(isoDate: string): string {
  const [yearRaw, monthRaw, dayRaw] = isoDate.split("-")
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  if (!year || !month || !day) return isoDate
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function isCoord(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value)
}
