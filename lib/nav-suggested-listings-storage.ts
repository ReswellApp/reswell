/**
 * Tracks marketplace listing IDs the user opened from header nav (idle suggestions or typeahead
 * “Top listings”) so we can surface them ahead of cold picks. Global popularity uses `listings.views`.
 */

const STORAGE_KEY = "reswell.header_nav_suggested_listing_scores"
const MAX_TRACKED_IDS = 48

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function trimScores(raw: Record<string, number>): Record<string, number> {
  const entries = Object.entries(raw).filter(
    ([id, n]) => UUID_RE.test(id) && Number.isFinite(n) && n > 0,
  )
  if (entries.length <= MAX_TRACKED_IDS) return Object.fromEntries(entries)
  entries.sort((a, b) => b[1] - a[1])
  return Object.fromEntries(entries.slice(0, MAX_TRACKED_IDS))
}

export function readNavSuggestedListingEngagement(): Record<string, number> {
  if (typeof window === "undefined") return {}
  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")
    if (!raw || typeof raw !== "object") return {}
    const next: Record<string, number> = {}
    for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
      const n = typeof v === "number" ? v : Number(v)
      if (Number.isFinite(n) && n > 0) next[k] = Math.floor(n)
    }
    return trimScores(next)
  } catch {
    return {}
  }
}

export function recordNavSuggestedListingEngagement(listingId: string): void {
  if (typeof window === "undefined") return
  if (!UUID_RE.test(listingId)) return
  try {
    const prev = readNavSuggestedListingEngagement()
    prev[listingId] = (prev[listingId] ?? 0) + 1
    localStorage.setItem(STORAGE_KEY, JSON.stringify(trimScores(prev)))
  } catch {
    /* ignore quota / private mode */
  }
}

export type NavSuggestedListingRankRow = {
  id: string
  views: number | null
  created_at: string
}

/**
 * Prefer listings this user opened from nav (`localScores`), then site-wide view counts, then recency.
 */
export function rankNavSuggestedSurfboardRows<T extends NavSuggestedListingRankRow>(
  rows: T[],
  localScores: Record<string, number>,
  limit: number,
): T[] {
  const scoreOf = (id: string) => localScores[id] ?? 0
  const viewsOf = (v: number | null | undefined) =>
    v != null && Number.isFinite(Number(v)) ? Number(v) : 0

  return [...rows]
    .sort((a, b) => {
      const ls = scoreOf(b.id) - scoreOf(a.id)
      if (ls !== 0) return ls
      const vs = viewsOf(b.views) - viewsOf(a.views)
      if (vs !== 0) return vs
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    .slice(0, limit)
}
