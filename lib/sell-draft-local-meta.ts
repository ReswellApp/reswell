/**
 * Session-scoped hint for the in-progress server draft listing id.
 * Lets /sell resume instantly without waiting for GET /api/listings/draft.
 * Cleared on publish, discard, or ?new=1.
 */

const STORAGE_KEY = "reswell.sell.serverDraftListingId"
/** Last server draft id for “Continue” banner — instant on return to /sell (revalidated in background). */
const REMOTE_RESUME_KEY = "reswell.sell.remoteResumeDraftId"

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

export function getRemoteResumeDraftIdFromStorage(): string | null {
  if (typeof window === "undefined") return null
  try {
    const v = sessionStorage.getItem(REMOTE_RESUME_KEY)
    if (!v || !UUID_RE.test(v)) return null
    return v
  } catch {
    return null
  }
}

export function setRemoteResumeDraftIdStorage(id: string): void {
  if (typeof window === "undefined") return
  if (!UUID_RE.test(id)) return
  try {
    sessionStorage.setItem(REMOTE_RESUME_KEY, id)
  } catch {
    /* ignore */
  }
}

export function clearRemoteResumeDraftIdStorage(): void {
  if (typeof window === "undefined") return
  try {
    sessionStorage.removeItem(REMOTE_RESUME_KEY)
  } catch {
    /* ignore */
  }
}
