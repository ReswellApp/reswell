"use client"

import posthog from "posthog-js"
import {
  dismissGiveawaySignupPopup,
  skipGiveawaySignupPopupAfterPublish,
} from "@/lib/giveaways/signup-popup-storage"

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

function parseJustPublishedListingMarker(raw: string): JustPublishedListingMarker | null {
  const parsed = JSON.parse(raw) as Partial<JustPublishedListingMarker>
  if (
    typeof parsed.listingId !== "string" ||
    typeof parsed.section !== "string" ||
    typeof parsed.ts !== "number"
  ) {
    return null
  }
  return {
    listingId: parsed.listingId,
    slug: typeof parsed.slug === "string" ? parsed.slug : null,
    section: parsed.section,
    ts: parsed.ts,
  }
}

function markerMatchesListing(marker: JustPublishedListingMarker, listingParam: string): boolean {
  return marker.listingId === listingParam || marker.slug === listingParam
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
  // Do this before navigate so the sitewide giveaway dialog cannot stack on the PDP.
  skipGiveawaySignupPopupAfterPublish()
  if (marker.section === "surfboards") {
    dismissGiveawaySignupPopup()
  }
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
 * Reads the marker when it matches the listing being viewed (by id or slug)
 * and is still fresh. Does not clear it.
 */
export function peekJustPublishedListingMarker(
  listingParam: string,
): JustPublishedListingMarker | null {
  if (typeof window === "undefined") return null
  try {
    const raw = sessionStorage.getItem(JUST_PUBLISHED_KEY)
    if (!raw) return null
    const marker = parseJustPublishedListingMarker(raw)
    if (!marker) {
      sessionStorage.removeItem(JUST_PUBLISHED_KEY)
      return null
    }
    if (!markerMatchesListing(marker, listingParam)) return null
    if (Date.now() - marker.ts > JUST_PUBLISHED_TTL_MS) return null
    return marker
  } catch {
    return null
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
    const marker = parseJustPublishedListingMarker(raw)
    if (!marker) {
      sessionStorage.removeItem(JUST_PUBLISHED_KEY)
      return null
    }
    if (!markerMatchesListing(marker, listingParam)) return null
    sessionStorage.removeItem(JUST_PUBLISHED_KEY)
    if (Date.now() - marker.ts > JUST_PUBLISHED_TTL_MS) return null
    return marker
  } catch {
    return null
  }
}
