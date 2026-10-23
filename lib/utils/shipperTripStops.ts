import { normalizeUsStateProvinceForShipping } from "@/lib/us-state-name-to-code"

/** Seeded corridor. These slugs stay as they are so existing runs keep their stops. */
const CORRIDOR_SLUGS = new Set([
  "capitola",
  "santa-cruz",
  "half-moon-bay",
  "pacifica",
  "san-francisco",
  "bolinas",
  "bodega-bay",
])

export type ShipperTripCityInput = {
  city: string
  state: string | null
  latitude: number
  longitude: number
}

export type ShipperStopIdentity =
  | { mode: "reuse"; slug: string }
  | { mode: "create"; slug: string; name: string }

export type LatitudeSortSlot = {
  sortOrder: number
  /** When set, add 1000 to every stop whose sort_order is at least this value before inserting. */
  shiftFrom: number | null
}

type KnownStop = {
  slug: string
  name: string
}

type LatitudeStop = {
  latitude?: number | null
  sortOrder: number
}

/** Lowercase slug safe for coastal_stops.slug. */
export function coastalCitySlug(value: string): string {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60)
}

/**
 * Match a Google city to an existing stop, or name the row to insert.
 * Corridor towns match on the city alone so Capitola stays Capitola.
 */
export function shipperStopIdentity(
  input: { city: string; state: string | null },
  existing: readonly KnownStop[],
): ShipperStopIdentity | null {
  const city = input.city.trim().replace(/\s+/g, " ")
  const citySlug = coastalCitySlug(city)
  if (!citySlug) return null

  const stateCode = normalizeState(input.state)
  const stateSlug = stateCode ? coastalCitySlug(stateCode) : ""
  const qualified = stateSlug ? `${citySlug}-${stateSlug}` : citySlug
  const bySlug = new Map(existing.map((stop) => [stop.slug, stop]))

  if (CORRIDOR_SLUGS.has(citySlug) && bySlug.has(citySlug)) {
    return { mode: "reuse", slug: citySlug }
  }
  if (bySlug.has(qualified)) return { mode: "reuse", slug: qualified }

  const createName = CORRIDOR_SLUGS.has(citySlug) || !stateCode ? city : `${city}, ${stateCode}`
  const byName = existing.find((stop) => normalizeName(stop.name) === normalizeName(createName))
  if (byName) return { mode: "reuse", slug: byName.slug }

  const preferred = CORRIDOR_SLUGS.has(citySlug) ? citySlug : qualified
  return { mode: "create", slug: uniqueSlug(preferred, new Set(bySlug.keys())), name: createName }
}

/**
 * Place a new city south to north by latitude without renumbering stops that already exist.
 * A full integer gap shifts the northern neighbor up so the new value can sit beside it.
 */
export function sortOrderForLatitude(latitude: number, stops: readonly LatitudeStop[]): LatitudeSortSlot {
  const used = new Set(stops.map((stop) => stop.sortOrder))
  const placed = stops
    .filter((stop): stop is { latitude: number; sortOrder: number } =>
      typeof stop.latitude === "number" && Number.isFinite(stop.latitude),
    )
    .slice()
    .sort((a, b) => a.latitude - b.latitude || a.sortOrder - b.sortOrder)

  let south: { latitude: number; sortOrder: number } | null = null
  let north: { latitude: number; sortOrder: number } | null = null
  for (const stop of placed) {
    if (stop.latitude <= latitude) south = stop
    else {
      north = stop
      break
    }
  }

  if (south && north) {
    const low = Math.min(south.sortOrder, north.sortOrder)
    const high = Math.max(south.sortOrder, north.sortOrder)
    const free = firstFree(low + 1, high - 1, used)
    if (free != null) return { sortOrder: free, shiftFrom: null }
    return { sortOrder: high, shiftFrom: high }
  }

  if (!south && north) {
    const min = Math.min(...stops.map((stop) => stop.sortOrder), north.sortOrder)
    return { sortOrder: firstBelow(min, used), shiftFrom: null }
  }

  if (south && !north) {
    const max = Math.max(...stops.map((stop) => stop.sortOrder), south.sortOrder)
    return { sortOrder: firstAbove(max, used), shiftFrom: null }
  }

  return { sortOrder: firstAbove(0, used), shiftFrom: null }
}

/** Drive order when every link has a position. Otherwise leave the query order. */
export function orderRunStopIds(
  links: readonly { stopId: string; position: number | null }[],
): { stopIds: string[]; stopsInDriveOrder: boolean } {
  const ranked = links.map((link, index) => ({ ...link, index }))
  const stopsInDriveOrder = ranked.length > 0 && ranked.every((link) => link.position != null)
  if (!stopsInDriveOrder) {
    return { stopIds: ranked.map((link) => link.stopId), stopsInDriveOrder: false }
  }
  ranked.sort((a, b) => {
    const left = a.position ?? 0
    const right = b.position ?? 0
    if (left !== right) return left - right
    return a.index - b.index
  })
  return { stopIds: ranked.map((link) => link.stopId), stopsInDriveOrder: true }
}

export type ShipperTripPlace = {
  city: string
  state: string | null
  latitude: number
  longitude: number
  label: string
}

export type ShipperTripSlot = {
  key: string
  place: ShipperTripPlace | null
}

/** From, intermediate stops, then To. Null until every city is chosen. */
export function orderedShipperPlaces(slots: readonly ShipperTripSlot[]): ShipperTripPlace[] | null {
  if (slots.some((slot) => slot.place == null)) return null
  return slots.flatMap((slot) => (slot.place ? [slot.place] : []))
}

export function appendShipperSlot<T>(slots: readonly T[], slot: T): T[] {
  return [...slots, slot]
}

export function removeShipperSlot<T extends { key: string }>(slots: readonly T[], key: string): T[] {
  return slots.filter((slot) => slot.key !== key)
}

export function tripStopNames(
  stopIds: readonly string[],
  stops: readonly { id: string; name: string; sortOrder: number }[],
  stopsInDriveOrder: boolean | undefined,
): string[] {
  const byId = new Map(stops.map((stop) => [stop.id, stop]))
  const chosen = stopIds.flatMap((id) => {
    const stop = byId.get(id)
    return stop ? [stop] : []
  })
  const list = stopsInDriveOrder
    ? chosen
    : [...chosen].sort((a, b) => a.sortOrder - b.sortOrder || a.id.localeCompare(b.id))
  return list.map((stop) => stop.name)
}

function normalizeState(state: string | null): string {
  const trimmed = state?.trim() ?? ""
  if (!trimmed) return ""
  return normalizeUsStateProvinceForShipping("US", trimmed)
}

function normalizeName(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ")
}

function uniqueSlug(base: string, taken: Set<string>): string {
  if (!taken.has(base)) return base
  for (let n = 2; n < 50; n += 1) {
    const next = `${base}-${n}`.slice(0, 80)
    if (!taken.has(next)) return next
  }
  return `${base}-x`.slice(0, 80)
}

function firstFree(start: number, end: number, used: Set<number>): number | null {
  if (start > end) return null
  const mid = Math.round((start + end) / 2)
  if (!used.has(mid)) return mid
  for (let value = mid - 1; value >= start; value -= 1) {
    if (!used.has(value)) return value
  }
  for (let value = mid + 1; value <= end; value += 1) {
    if (!used.has(value)) return value
  }
  return null
}

function firstBelow(start: number, used: Set<number>): number {
  let candidate = start - 1000
  while (used.has(candidate)) candidate -= 1
  return candidate
}

function firstAbove(start: number, used: Set<number>): number {
  let candidate = start + 1000
  while (used.has(candidate)) candidate += 1
  return candidate
}
