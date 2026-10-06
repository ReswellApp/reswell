import type {
  CoastalDirection,
  CoastalMatch,
  CoastalMatchResult,
  CoastalStopView,
} from "@/lib/types/coastal-delivery"

const PACIFIC_TIME_ZONE = "America/Los_Angeles"
const WEEKDAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const

export type CoastalMatchStop = {
  id: string
  sortOrder: number
}

export type CoastalMatchRun = {
  id: string
  dayOfWeek: number
  direction: CoastalDirection
  enabled: boolean
  stopIds: string[]
}

export type CoastalMatchShipper = {
  shipperId: string
  displayName: string
  scheduleEnabled: boolean
  runs: CoastalMatchRun[]
}

export function coastalDirectionLabel(direction: CoastalDirection): string {
  return direction === "northbound" ? "Northbound" : "Southbound"
}

/** Inclusive coast range. Fewer than two stops returns null. */
export function coastalContinuousStopIds(
  stops: readonly CoastalMatchStop[],
  fromId: string,
  toId: string,
): string[] | null {
  const ordered = [...stops].sort((a, b) => a.sortOrder - b.sortOrder)
  const from = ordered.findIndex((stop) => stop.id === fromId)
  const to = ordered.findIndex((stop) => stop.id === toId)
  if (from < 0 || to < 0) return null
  const start = Math.min(from, to)
  const end = Math.max(from, to)
  const range = ordered.slice(start, end + 1).map((stop) => stop.id)
  return range.length >= 2 ? range : null
}

export function formatCoastalRunWhen(dayOfWeek: number, nextRunOn: string): string {
  const weekday = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][dayOfWeek] ?? "Run"
  const [yearRaw, monthRaw, dayRaw] = nextRunOn.split("-")
  const year = Number(yearRaw)
  const month = Number(monthRaw)
  const day = Number(dayRaw)
  if (!year || !month || !day) return weekday
  const pretty = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)))
  return `${weekday}, ${pretty}`
}

export function routeDirection(pickupSort: number, dropoffSort: number): CoastalDirection | null {
  if (dropoffSort > pickupSort) return "northbound"
  if (dropoffSort < pickupSort) return "southbound"
  return null
}

/** Next calendar date in America/Los_Angeles for this weekday, including today. */
export function nextRunDateIso(now: Date, dayOfWeek: number): string {
  const civil = pacificCivilDate(now)
  const delta = (dayOfWeek - civil.weekday + 7) % 7
  return formatIsoDate(civil.year, civil.month, civil.day + delta)
}

/** This weekday inside the America/Los_Angeles week that contains `now` (Sunday through Saturday). */
export function pacificWeekDateIso(now: Date, dayOfWeek: number): string {
  const civil = pacificCivilDate(now)
  return formatIsoDate(civil.year, civil.month, civil.day - civil.weekday + dayOfWeek)
}

function formatIsoDate(year: number, month: number, day: number): string {
  const utc = new Date(Date.UTC(year, month - 1, day))
  const y = utc.getUTCFullYear()
  const m = String(utc.getUTCMonth() + 1).padStart(2, "0")
  const d = String(utc.getUTCDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function suggestPickupStopId(city: string | null | undefined, stops: CoastalStopView[]): string | null {
  const normalized = normalizePlace(city)
  if (!normalized) return null
  const match = stops.find((stop) => normalizePlace(stop.name) === normalized)
  return match?.id ?? null
}

export function matchCoastalShippers(input: {
  pickup: CoastalMatchStop
  dropoff: CoastalMatchStop
  shippers: CoastalMatchShipper[]
  now: Date
}): CoastalMatchResult {
  if (input.pickup.id === input.dropoff.id) {
    return { reason: "same_stop", matches: [] }
  }

  const direction = routeDirection(input.pickup.sortOrder, input.dropoff.sortOrder)
  if (!direction) {
    return { reason: "no_route_match", matches: [] }
  }

  if (input.shippers.length === 0) {
    return { reason: "no_shippers", matches: [] }
  }

  const matches: CoastalMatch[] = []
  let coveringButOff = false

  for (const shipper of input.shippers) {
    const covering = shipper.runs.filter((run) => runCovers(run, input.pickup.id, input.dropoff.id, direction))
    if (covering.length === 0) continue

    const active = covering.filter((run) => shipper.scheduleEnabled && run.enabled)
    if (active.length === 0) {
      coveringButOff = true
      continue
    }

    const soonest = soonestRun(active, input.now)
    matches.push({
      shipperId: shipper.shipperId,
      displayName: shipper.displayName,
      runId: soonest.id,
      dayOfWeek: soonest.dayOfWeek,
      direction: soonest.direction,
      nextRunOn: nextRunDateIso(input.now, soonest.dayOfWeek),
    })
  }

  matches.sort((a, b) => a.nextRunOn.localeCompare(b.nextRunOn) || a.displayName.localeCompare(b.displayName))

  if (matches.length > 0) return { reason: "ok", matches }
  if (coveringButOff) return { reason: "schedules_off", matches: [] }
  return { reason: "no_route_match", matches: [] }
}

function runCovers(
  run: CoastalMatchRun,
  pickupId: string,
  dropoffId: string,
  direction: CoastalDirection,
): boolean {
  return run.direction === direction && run.stopIds.includes(pickupId) && run.stopIds.includes(dropoffId)
}

function soonestRun(runs: CoastalMatchRun[], now: Date): CoastalMatchRun {
  const [soonest] = [...runs].sort((a, b) => {
    const byDate = nextRunDateIso(now, a.dayOfWeek).localeCompare(nextRunDateIso(now, b.dayOfWeek))
    if (byDate !== 0) return byDate
    return a.id.localeCompare(b.id)
  })
  if (!soonest) throw new Error("Expected a covering run")
  return soonest
}

function normalizePlace(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim()
}

function pacificCivilDate(now: Date): { year: number; month: number; day: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: PACIFIC_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now)

  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? ""
  const weekday = WEEKDAY_SHORT.indexOf(read("weekday") as (typeof WEEKDAY_SHORT)[number])
  if (weekday < 0) {
    throw new Error("Could not read Pacific weekday")
  }

  return {
    year: Number(read("year")),
    month: Number(read("month")),
    day: Number(read("day")),
    weekday,
  }
}
