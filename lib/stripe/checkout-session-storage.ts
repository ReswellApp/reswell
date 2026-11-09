const STORAGE_PREFIX = "reswell.checkout.session.v1:"

export function checkoutSessionStorageKey(input: {
  listingIdsKey: string
  quantitiesKey: string
  offerId: string | null
}): string {
  return `${STORAGE_PREFIX}${[
    input.listingIdsKey,
    input.quantitiesKey,
    input.offerId ?? "",
  ].join("|")}`
}

export function readStoredCheckoutSessionId(key: string): string | null {
  if (typeof window === "undefined") return null
  try {
    const value = window.sessionStorage.getItem(key)?.trim() ?? ""
    return value || null
  } catch {
    return null
  }
}

export function writeStoredCheckoutSessionId(key: string, sessionId: string): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.setItem(key, sessionId)
  } catch {
    // Private mode / quota — resume still works via buyer+fingerprint on the server.
  }
}

export function clearStoredCheckoutSessionId(key: string): void {
  if (typeof window === "undefined") return
  try {
    window.sessionStorage.removeItem(key)
  } catch {
    // ignore
  }
}
