"use client"

import posthog from "posthog-js"

/**
 * SessionStorage handoff from the sell flows to the listing detail page so the
 * PDP can show a one-time "your listing is live" celebration after a fresh
 * publish (never on edits). Kept out of the URL so shared links stay clean and
 * the ISR page shell is untouched.
 */

const JUST_PUBLISHED_KEY = "reswell.sell.justPublished"

/** Marker is ignored after this long (e.g. stale tab restored much later). */
const JUST_PUBLISHED_TTL_MS = 5 * 60 * 1000

export interface JustPublishedListingMarker {
  listingId: string
  slug: string | null
  section: string
  ts: number
}

export function setJustPublishedListingMarker(marker: {
  listingId: string
  slug: string | null
  section: string
}): void {
  if (typeof window === "undefined") return
  posthog.capture("listing_published", {
    listing_id: marker.listingId,
    listing_type: marker.section,
    is_new_listing: true,
  })
  try {
    sessionStorage.setItem(
      JUST_PUBLISHED_KEY,
      JSON.stringify({ ...marker, ts: Date.now() } satisfies JustPublishedListingMarker),
    )
  } catch {
    /* quota / private mode — celebration is best-effort */
  }
}

/**
 * Reads and clears the marker when it matches the listing being viewed
 * (by id or slug) and is still fresh. Returns `null` otherwise.
 */
export function consumeJustPublishedListingMarker(
  listingParam: string,
): JustPublishedListingMarker | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(JUST_PUBLISHED_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as Partial<JustPublishedListingMarker>
    if (
      typeof parsed.listingId !== "string" ||
      typeof parsed.section !== "string" ||
      typeof parsed.ts !== "number"
    ) {
      sessionStorage.removeItem(JUST_PUBLISHED_KEY)
      return null
    }
    const matches = parsed.listingId === listingParam || parsed.slug === listingParam
    if (!matches) return null
    sessionStorage.removeItem(JUST_PUBLISHED_KEY)
    if (Date.now() - parsed.ts > JUST_PUBLISHED_TTL_MS) return null
    return {
      listingId: parsed.listingId,
      slug: typeof parsed.slug === "string" ? parsed.slug : null,
      section: parsed.section,
      ts: parsed.ts,
    }
  } catch {
    return null
  }
}
