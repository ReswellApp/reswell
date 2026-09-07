import {
  US_STATE_NAME_TO_CODE,
  usStateTitleCaseName,
} from "@/lib/us-state-name-to-code"

function escOrPattern(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

const COUNTRY_LABELS = new Set([
  "usa",
  "us",
  "u.s.",
  "u.s.a.",
  "united states",
  "united states of america",
])

/** `CA 93101` / `CA 93101-1234` from Google formatted addresses. */
const STATE_CODE_WITH_ZIP = /^([A-Za-z]{2})\s+\d{5}(?:-\d{4})?$/

export type ParsedBrowseLocation = {
  city: string | null
  stateCode: string | null
  stateRaw: string | null
}

function resolveStatePart(raw: string): string | null {
  const t = raw.trim()
  const withZip = t.match(STATE_CODE_WITH_ZIP)
  if (withZip) return withZip[1]!.toUpperCase()
  if (/^[a-z]{2}$/i.test(t)) return t.toUpperCase()
  return US_STATE_NAME_TO_CODE[t.toLowerCase()] ?? null
}

/**
 * Parse a geocoder-style label into city + optional US state.
 * `"Santa Barbara, CA, USA"` → city Santa Barbara, state CA — not country as state.
 */
export function parseBrowseLocationLabel(locationRaw: string): ParsedBrowseLocation {
  const location = locationRaw.trim()
  if (!location) return { city: null, stateCode: null, stateRaw: null }

  const parts = location.split(",").map((p) => p.trim()).filter(Boolean)
  while (parts.length > 0 && COUNTRY_LABELS.has(parts[parts.length - 1]!.toLowerCase())) {
    parts.pop()
  }

  if (parts.length === 0) return { city: null, stateCode: null, stateRaw: null }

  if (parts.length === 1) {
    const only = parts[0]!
    const code = resolveStatePart(only)
    const isStateOnly =
      Boolean(code) && (only.length === 2 || Boolean(US_STATE_NAME_TO_CODE[only.toLowerCase()]))
    if (isStateOnly) {
      return { city: null, stateCode: code, stateRaw: only }
    }
    return { city: only, stateCode: null, stateRaw: null }
  }

  const city = parts[0]!
  const statePart = parts[parts.length - 1]!
  return {
    city,
    stateCode: resolveStatePart(statePart),
    stateRaw: statePart,
  }
}

function applyStateFilter(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase query builder chain
  dbQuery: any,
  stateCode: string | null,
  stateRaw: string | null,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase query builder chain
): any {
  if (stateCode) {
    const clauses = [`state.eq."${stateCode}"`]
    const name = usStateTitleCaseName(stateCode)
    if (name) clauses.push(`state.ilike."%${escOrPattern(name)}%"`)
    if (stateRaw) {
      const rawEsc = escOrPattern(stateRaw)
      if (rawEsc.toUpperCase() !== stateCode) {
        clauses.push(`state.ilike."%${rawEsc}%"`)
      }
    }
    return dbQuery.or(clauses.join(","))
  }
  if (stateRaw) {
    return dbQuery.ilike("state", `%${stateRaw}%`)
  }
  return dbQuery
}

/**
 * Narrows `listings` by `city` / `state` for geocoder-style labels ("Santa Barbara, California").
 * Chains filters (AND) instead of one ilike on the full string, which never matched `city` alone.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase query builder chain
export function applyListingsLocationTextFilter(dbQuery: any, locationRaw: string): any {
  const location = locationRaw.trim()
  if (!location) return dbQuery

  const { city, stateCode, stateRaw } = parseBrowseLocationLabel(location)

  if (city && (stateCode || stateRaw)) {
    return applyStateFilter(dbQuery.ilike("city", `%${city}%`), stateCode, stateRaw)
  }
  if (city) {
    return dbQuery.ilike("city", `%${city}%`)
  }
  if (stateCode || stateRaw) {
    return applyStateFilter(dbQuery, stateCode, stateRaw)
  }

  const escFull = escOrPattern(location)
  return dbQuery.or(`city.ilike."%${escFull}%",state.ilike."%${escFull}%"`)
}
