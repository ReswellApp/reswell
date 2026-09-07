"use client"

import { useEffect } from "react"
import posthog from "posthog-js"

/** Deduplicate React Strict Mode double effect + very fast remounts (same id). */
const lastSentAt = new Map<string, number>()
const DEDUPE_MS = 2500

function shouldRecord(listingId: string) {
  const now = Date.now()
  const t = lastSentAt.get(listingId) ?? 0
  if (now - t < DEDUPE_MS) return false
  lastSentAt.set(listingId, now)
  return true
}

/**
 * Fires once per real visit to `/l/...` so `listings.views` reflects traffic.
 * Renders nothing.
 */
export function ListingViewTracker({ listingId }: { listingId: string }) {
  useEffect(() => {
    if (!shouldRecord(listingId)) return
    posthog.capture("listing_viewed", { listing_id: listingId })
    void fetch(`/api/listings/${encodeURIComponent(listingId)}/view`, {
      method: "POST",
      credentials: "include",
    })
  }, [listingId])
  return null
}
