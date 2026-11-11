import type { SearchSuggestPickPayload } from "@/lib/services/searchAnalytics"
import { isBenignClientFetchError } from "@/lib/utils/is-abort-error"

/**
 * Fire-and-forget typeahead pick analytics via a route handler.
 *
 * Must not use a Server Action: those POST to the current page and join the
 * Next.js navigation queue, so hovering a suggestion then hitting Enter can
 * wait on a slow network instead of searching.
 *
 * Hover dwell is a client no-op (the server also drops hovers).
 */
export function recordSearchSuggestPick(payload: SearchSuggestPickPayload): void {
  if ((payload.interaction ?? "pick") === "hover") return
  if (typeof window === "undefined") return

  void fetch("/api/search/suggest-pick", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch((err) => {
    if (!isBenignClientFetchError(err) && process.env.NODE_ENV === "development") {
      console.warn("[search] suggest pick analytics failed:", err)
    }
  })
}
