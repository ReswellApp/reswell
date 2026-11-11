import type { NavSearchPersonalization } from "@/lib/types/nav-search-personalization"
import { isBenignClientFetchError } from "@/lib/utils/is-abort-error"

function postPersonalization(body: unknown): void {
  if (typeof window === "undefined") return
  void fetch("/api/nav/personalization", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    keepalive: true,
  }).catch((err) => {
    if (!isBenignClientFetchError(err) && process.env.NODE_ENV === "development") {
      console.warn("[search] personalization write failed:", err)
    }
  })
}

/**
 * Load signed-in header search recents. Fetch, not a Server Action, so focusing
 * the bar on a slow connection cannot stall Enter → `/search`.
 */
export async function fetchNavSearchPersonalization(): Promise<
  NavSearchPersonalization | { error: string }
> {
  try {
    const res = await fetch("/api/nav/personalization", { credentials: "include" })
    if (!res.ok) return { error: "Unauthorized" }
    const json = (await res.json()) as { data?: NavSearchPersonalization; error?: string }
    if (json.data) return json.data
    return { error: json.error ?? "Failed to load" }
  } catch (err) {
    if (!isBenignClientFetchError(err) && process.env.NODE_ENV === "development") {
      console.warn("[search] personalization load failed:", err)
    }
    return { error: "Failed to load" }
  }
}

export function recordNavSearchPersonalizationQuery(query: string): void {
  postPersonalization({ op: "record-query", query })
}

export function removeNavSearchPersonalizationQuery(query: string): void {
  postPersonalization({ op: "remove-query", query })
}

export function recordNavRecentlyViewedBrand(input: {
  name: string
  slug?: string | null
}): void {
  postPersonalization({ op: "record-brand", name: input.name, slug: input.slug })
}
