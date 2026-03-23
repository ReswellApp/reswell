import { US_STATE_NAME_TO_CODE } from "@/lib/us-state-name-to-code"

function escOrPattern(s: string) {
  return s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

/**
 * Narrows `listings` by `city` / `state` for geocoder-style labels ("Santa Barbara, California").
 * Chains filters (AND) instead of one ilike on the full string, which never matched `city` alone.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- Supabase query builder chain
export function applyListingsLocationTextFilter(dbQuery: any, locationRaw: string): any {
  const location = locationRaw.trim()
  if (!location) return dbQuery

  const parts = location.split(",").map((p) => p.trim()).filter(Boolean)
  const escFull = escOrPattern(location)

  if (parts.length >= 2) {
    const cityRaw = parts[0]
    const stateRaw = parts[parts.length - 1]
    const stateEsc = escOrPattern(stateRaw)
    const t = stateRaw.trim()
    let q = dbQuery.ilike("city", `%${cityRaw}%`)
    if (/^[a-z]{2}$/i.test(t)) {
      return q.eq("state", t.toUpperCase())
    }
    const code = US_STATE_NAME_TO_CODE[t.toLowerCase()]
    if (code) {
      return q.or(`state.ilike."%${stateEsc}%",state.eq."${code}"`)
    }
    return q.ilike("state", `%${stateRaw}%`)
  }

  return dbQuery.or(`city.ilike."%${escFull}%",state.ilike."%${escFull}%"`)
}
