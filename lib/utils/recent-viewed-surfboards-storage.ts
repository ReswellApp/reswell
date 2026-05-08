const STORAGE_KEY = "reswell:recent-surfboard-ids"
const MAX_IDS = 48

/**
 * Client-only: append surfboard listing views for PDP “recently viewed” strips.
 */
export function pushRecentSurfboardListingId(listingId: string): void {
  if (typeof window === "undefined") return
  const id = listingId.trim()
  if (!id) return
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const prev = raw ? (JSON.parse(raw) as unknown) : []
    const prior = Array.isArray(prev) ? prev.filter((x): x is string => typeof x === "string") : []
    const next = [id, ...prior.filter((x) => x !== id)].slice(0, MAX_IDS)
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota / private mode */
  }
}

export function readRecentSurfboardListingIds(): string[] {
  if (typeof window === "undefined") return []
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? (JSON.parse(raw) as unknown) : []
    return Array.isArray(parsed)
      ? parsed.filter((x): x is string => typeof x === "string" && x.trim() !== "")
      : []
  } catch {
    return []
  }
}
