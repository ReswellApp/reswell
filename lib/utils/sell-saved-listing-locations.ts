/**
 * Client-side recent listing localities for /sell (guests + fast first paint).
 * Locality + pin only — never street addresses.
 */

export type SellSavedListingLocation = {
  city: string
  state: string
  lat: number
  lng: number
  displayName: string
}

const STORAGE_KEY = "reswell.sell.savedListingLocations"
const MAX_SAVED = 5

function hasCoords(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && !(lat === 0 && lng === 0)
}

function normalizeKey(loc: Pick<SellSavedListingLocation, "city" | "state" | "lat" | "lng">): string {
  const city = loc.city.trim().toLowerCase()
  const state = loc.state.trim().toLowerCase()
  const lat = Math.round(loc.lat * 1000) / 1000
  const lng = Math.round(loc.lng * 1000) / 1000
  return `${city}|${state}|${lat}|${lng}`
}

function parseSaved(raw: unknown): SellSavedListingLocation | null {
  if (!raw || typeof raw !== "object") return null
  const o = raw as Record<string, unknown>
  const city = typeof o.city === "string" ? o.city.trim() : ""
  const state = typeof o.state === "string" ? o.state.trim() : ""
  const displayName =
    typeof o.displayName === "string" && o.displayName.trim()
      ? o.displayName.trim()
      : [city, state].filter(Boolean).join(", ")
  const lat = typeof o.lat === "number" ? o.lat : Number(o.lat)
  const lng = typeof o.lng === "number" ? o.lng : Number(o.lng)
  if (!city || !hasCoords(lat, lng)) return null
  return { city, state, lat, lng, displayName }
}

export function readSellSavedListingLocations(): SellSavedListingLocation[] {
  if (typeof window === "undefined") return []
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    const out: SellSavedListingLocation[] = []
    const seen = new Set<string>()
    for (const item of parsed) {
      const loc = parseSaved(item)
      if (!loc) continue
      const key = normalizeKey(loc)
      if (seen.has(key)) continue
      seen.add(key)
      out.push(loc)
      if (out.length >= MAX_SAVED) break
    }
    return out
  } catch {
    return []
  }
}

/** Most recent first. Dedupes by city/state/rounded pin. */
export function rememberSellSavedListingLocation(
  loc: SellSavedListingLocation,
): SellSavedListingLocation[] {
  if (typeof window === "undefined") return []
  if (!loc.city.trim() || !hasCoords(loc.lat, loc.lng)) {
    return readSellSavedListingLocations()
  }
  const next: SellSavedListingLocation = {
    city: loc.city.trim(),
    state: (loc.state ?? "").trim(),
    lat: loc.lat,
    lng: loc.lng,
    displayName:
      loc.displayName.trim() ||
      [loc.city.trim(), (loc.state ?? "").trim()].filter(Boolean).join(", "),
  }
  const key = normalizeKey(next)
  const rest = readSellSavedListingLocations().filter((x) => normalizeKey(x) !== key)
  const merged = [next, ...rest].slice(0, MAX_SAVED)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  } catch {
    /* quota / private mode */
  }
  return merged
}
