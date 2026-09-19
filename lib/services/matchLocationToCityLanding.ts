import { cityNameSlug, findCityByLandingSlug } from "../city-landing-path.ts"
import { US_STATE_CODE_TO_NAME, US_STATE_NAME_TO_CODE } from "../us-state-name-to-code.ts"

function normalizeStateCode(state: string | null | undefined): string {
  const trimmed = (state ?? "").trim()
  if (!trimmed) return ""
  if (/^[a-z]{2}$/i.test(trimmed)) return trimmed.toUpperCase()
  return US_STATE_NAME_TO_CODE[trimmed.toLowerCase()] ?? trimmed
}

function localityKey(city: string, state: string | null | undefined): string {
  return `${city.trim().toLowerCase()}|${normalizeStateCode(state).toLowerCase()}`
}

export type LocationToCityQuery = {
  label: string
  city?: string
  state?: string
}

export type CityLandingMatchFields = {
  slug: string
  city: string
  state: string | null
  href: string
  label: string
}

const COUNTRY_TOKENS = new Set([
  "usa",
  "us",
  "united states",
  "united states of america",
  "america",
])

const ZIP_RE = /^\d{5}(?:-\d{4})?$/

function isCountryToken(value: string): boolean {
  return COUNTRY_TOKENS.has(value.trim().toLowerCase())
}

function isZipToken(value: string): boolean {
  return ZIP_RE.test(value.trim())
}

function isStateToken(value: string): boolean {
  const trimmed = value.trim()
  if (!trimmed) return false
  if (/^[a-z]{2}$/i.test(trimmed)) {
    return Boolean(US_STATE_CODE_TO_NAME[trimmed.toUpperCase()])
  }
  return Boolean(US_STATE_NAME_TO_CODE[trimmed.toLowerCase()])
}

function localityTokens(label: string): { tokens: string[]; state: string | null } {
  const parts = label
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !isCountryToken(part) && !isZipToken(part))

  let state: string | null = null
  if (parts.length >= 2) {
    const last = parts[parts.length - 1]
    if (last && isStateToken(last)) {
      state = normalizeStateCode(last) || null
      parts.pop()
    }
  }

  return { tokens: parts, state }
}

function candidateLocalities(query: LocationToCityQuery): Array<{ city: string; state: string | null }> {
  const fromLabel = localityTokens(query.label)
  const state = normalizeStateCode(query.state) || fromLabel.state
  const seen = new Set<string>()
  const out: Array<{ city: string; state: string | null }> = []

  const push = (city: string, nextState: string | null) => {
    const trimmed = city.trim()
    if (!trimmed || isZipToken(trimmed) || isStateToken(trimmed)) return
    const key = localityKey(trimmed, nextState)
    if (seen.has(key)) return
    seen.add(key)
    out.push({ city: trimmed, state: nextState })
  }

  if (query.city?.trim()) push(query.city, state)
  for (const token of fromLabel.tokens) push(token, state)

  return out
}

function matchLocality<T extends CityLandingMatchFields>(
  cities: readonly T[],
  city: string,
  state: string | null,
): T | null {
  if (state) {
    const key = localityKey(city, state)
    const exact = cities.find((row) => localityKey(row.city, row.state) === key)
    if (exact) return exact
  }

  const nameSlug = cityNameSlug(city)
  if (!nameSlug) return null
  return findCityByLandingSlug(cities, nameSlug)
}

/** Map a location search (typed label or a picked place) to a city landing, if one exists. */
export function matchLocationToCityLanding<T extends CityLandingMatchFields>(
  query: LocationToCityQuery,
  cities: readonly T[],
): T | null {
  const label = query.label.trim()
  if (!label || isZipToken(label)) return null

  for (const candidate of candidateLocalities(query)) {
    const match = matchLocality(cities, candidate.city, candidate.state)
    if (match) return match
  }

  return null
}
