/** Persist last marketplace search query for the header bar (session-only). */
export const NAV_SEARCH_QUERY_KEY = "reswell.navSearchQuery"

export function readNavSearchQuery(): string {
  if (typeof window === "undefined") return ""
  try {
    return sessionStorage.getItem(NAV_SEARCH_QUERY_KEY)?.trim() ?? ""
  } catch {
    return ""
  }
}

export function writeNavSearchQuery(q: string) {
  try {
    if (q.trim()) sessionStorage.setItem(NAV_SEARCH_QUERY_KEY, q.trim())
    else sessionStorage.removeItem(NAV_SEARCH_QUERY_KEY)
  } catch {
    /* ignore */
  }
}

export function clearNavSearchQuery() {
  try {
    sessionStorage.removeItem(NAV_SEARCH_QUERY_KEY)
  } catch {
    /* ignore */
  }
}
