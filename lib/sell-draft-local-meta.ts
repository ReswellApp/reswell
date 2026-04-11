/**
 * Session-scoped hint for the in-progress server draft listing id.
 * Lets /sell resume instantly without waiting for GET /api/listings/draft.
 * Cleared on publish, discard, or ?new=1.
 */

const STORAGE_KEY = "reswell.sell.serverDraftListingId"

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function getSellServerDraftListingId(): string | null {
  if (typeof window === "undefined") return null
  try {
    const v = sessionStorage.getItem(STORAGE_KEY)
    if (!v || !UUID_RE.test(v)) return null
    return v
  } catch {
    return null
  }
}

export function setSellServerDraftListingId(id: string): void {
  if (typeof window === "undefined") return
  if (!UUID_RE.test(id)) return
  try {
    sessionStorage.setItem(STORAGE_KEY, id)
  } catch {
    /* quota / private mode */
  }
}

export function clearSellServerDraftListingId(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* ignore */
  }
}
