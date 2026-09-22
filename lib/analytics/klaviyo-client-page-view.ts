import { hasMarketingConsent } from "./marketing-consent"

const STORAGE_KEY = "rw_klaviyo_anon_id"

function getOrCreateAnonymousId(): string {
  try {
    let id = localStorage.getItem(STORAGE_KEY)
    if (!id || id.length < 8) {
      id =
        typeof crypto !== "undefined" && crypto.randomUUID
          ? crypto.randomUUID()
          : `anon_${Math.random().toString(36).slice(2)}_${Date.now()}`
      localStorage.setItem(STORAGE_KEY, id)
    }
    return id
  } catch {
    return `sess_${Math.random().toString(36).slice(2)}_${Date.now()}`
  }
}

/**
 * First-party Klaviyo page-view beacon. No-ops without marketing consent.
 * Logged-out visitors get a stable `anonymous_id` in localStorage.
 */
export function sendKlaviyoClientPageView(pathname: string, searchString: string): void {
  if (!hasMarketingConsent()) return

  const anonId = getOrCreateAnonymousId()
  void fetch("/api/integrations/klaviyo/page-view", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    keepalive: true,
    body: JSON.stringify({
      pathname,
      ...(searchString ? { search: searchString } : {}),
      anonymous_id: anonId,
    }),
  }).catch(() => {})
}
