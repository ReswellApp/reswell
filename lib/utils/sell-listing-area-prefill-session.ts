/**
 * Mirrors the seller’s default listing area hint in sessionStorage for instant revisit of /sell
 * (cold Supabase rounds may take 100–400ms otherwise).
 */

const STORAGE_KEY = (uid: string) =>
  `reswell:v1:sellListingAreaPrefill:${encodeURIComponent(uid)}`

const TTL_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

type StoredPayload = {
  city: string
  state: string
  ts: number
}

export function readSellListingAreaPrefillFromSession(uid: string): {
  city: string
  state: string
} | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY(uid))
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<StoredPayload>
    if (
      typeof parsed.city !== "string" ||
      !parsed.city.trim() ||
      typeof parsed.ts !== "number"
    ) {
      sessionStorage.removeItem(STORAGE_KEY(uid))
      return null
    }
    if (Date.now() - parsed.ts > TTL_MS) {
      sessionStorage.removeItem(STORAGE_KEY(uid))
      return null
    }
    return {
      city: parsed.city.trim(),
      state: typeof parsed.state === "string" ? parsed.state.trim() : "",
    }
  } catch {
    try {
      sessionStorage.removeItem(STORAGE_KEY(uid))
    } catch {
      /* ignore */
    }
    return null
  }
}

export function writeSellListingAreaPrefillToSession(
  uid: string,
  value: { city: string; state: string } | null,
): void {
  if (typeof window === "undefined") return
  const key = STORAGE_KEY(uid)
  try {
    if (!value?.city.trim()) {
      sessionStorage.removeItem(key)
      return
    }
    const payload: StoredPayload = {
      city: value.city.trim(),
      state: (value.state ?? "").trim(),
      ts: Date.now(),
    }
    sessionStorage.setItem(key, JSON.stringify(payload))
  } catch {
    /* quota / private mode */
  }
}
