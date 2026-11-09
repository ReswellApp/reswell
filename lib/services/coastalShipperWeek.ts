import { nextRunDateIso, pacificTodayIso } from "@/lib/services/coastalDeliveryMatch"
import type { CoastalRunView, CoastalShipperProfileView } from "@/lib/types/coastal-delivery"

export function shipperAccountLine(profile: Pick<CoastalShipperProfileView, "email" | "isShop">): string {
  const email = profile.email?.trim() || "No email on this account"
  return profile.isShop ? `${email} · Shop` : email
}

/** One line. Schedule off, schedule on, and runs on are not three boxes. */
export function shipperWeekStatusLine(profile: {
  scheduleEnabled: boolean
  runs: readonly { enabled: boolean }[]
}): string {
  if (!profile.scheduleEnabled) return "Shipper is off."
  const on = profile.runs.filter((run) => run.enabled).length
  if (on === 0) return "Shipper is on."
  return on === 1 ? "Shipper is on. One run can take boards." : `Shipper is on. ${on} runs can take boards.`
}

export function addIsoDays(iso: string, days: number): string {
  const [year, month, day] = iso.split("-").map(Number)
  if (!year || !month || !day) return iso
  const date = new Date(Date.UTC(year, month - 1, day + days))
  return date.toISOString().slice(0, 10)
}

export function isoWeekday(iso: string): number | null {
  const [year, month, day] = iso.split("-").map(Number)
  if (!year || !month || !day) return null
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay()
}

/** Dated trips in this week replace the weekly trip for that day and direction. */
export function tripsForWeek(trips: readonly CoastalRunView[], weekStart: string): CoastalRunView[] {
  const weekEnd = addIsoDays(weekStart, 6)
  const dated = trips.filter(
    (trip) => typeof trip.serviceDate === "string" && trip.serviceDate >= weekStart && trip.serviceDate <= weekEnd,
  )
  const replaced = new Set(dated.map((trip) => `${trip.serviceDate}:${trip.direction}`))
  const weekly = trips.filter((trip) => {
    if (trip.serviceDate) return false
    const date = addIsoDays(weekStart, trip.dayOfWeek)
    return !replaced.has(`${date}:${trip.direction}`)
  })
  return [...weekly, ...dated].sort((a, b) => a.dayOfWeek - b.dayOfWeek || a.direction.localeCompare(b.direction))
}

export function shipperServesPoint(input: {
  latitude: number
  city: string
  line1: string
  regionLatitudes: number[] | undefined
  exclusions: readonly string[] | undefined
}): boolean {
  const haystack = `${input.city} ${input.line1}`.toLowerCase()
  const blocked = (input.exclusions ?? []).some((label) => {
    const needle = label.trim().toLowerCase()
    return needle.length > 1 && haystack.includes(needle)
  })
  if (blocked) return false
  if (!input.regionLatitudes) return true
  if (input.regionLatitudes.length === 0) return false
  const south = Math.min(...input.regionLatitudes) - 0.2
  const north = Math.max(...input.regionLatitudes) + 0.2
  return input.latitude >= south && input.latitude <= north
}

type TripDateRun = {
  id: string
  dayOfWeek: number
  direction: string
  enabled: boolean
  serviceDate?: string | null
}

const TRIP_HORIZON_WEEKS = 8

/**
 * Soonest drive a shipper will actually make.
 * A dated trip replaces the weekly trip on that day and direction.
 * A dated trip that is off cancels that week and the weekly trip resumes the next one.
 */
export function soonestEnabledTrip<T extends TripDateRun>(
  now: Date,
  runs: readonly T[],
): { run: T; date: string } | null {
  const today = pacificTodayIso(now)
  const candidates: { run: T; date: string }[] = []

  for (const run of runs) {
    if (!run.enabled) continue
    if (run.serviceDate) {
      if (run.serviceDate >= today) candidates.push({ run, date: run.serviceDate })
      continue
    }
    let date = nextRunDateIso(now, run.dayOfWeek)
    for (let week = 0; week < TRIP_HORIZON_WEEKS; week += 1) {
      const replacement = runs.find((other) => other.serviceDate === date && other.direction === run.direction)
      if (!replacement) {
        candidates.push({ run, date })
        break
      }
      if (replacement.enabled) break
      date = addIsoDays(date, 7)
    }
  }

  candidates.sort((a, b) => a.date.localeCompare(b.date) || a.run.id.localeCompare(b.run.id))
  return candidates[0] ?? null
}

export function tripDateForWeek(
  weekStart: string,
  dayOfWeek: number,
  repeating: boolean,
): { serviceDate: string | null; dayOfWeek: number } | null {
  if (dayOfWeek < 0 || dayOfWeek > 6) return null
  if (repeating) return { serviceDate: null, dayOfWeek }
  const serviceDate = addIsoDays(weekStart, dayOfWeek)
  return isoWeekday(serviceDate) === dayOfWeek ? { serviceDate, dayOfWeek } : null
}
