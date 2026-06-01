"use client"

import { useEffect } from "react"

import { trackMetaViewContent } from "@/lib/meta/pixel-events"

/** Dedup React Strict Mode double effects + fast remounts of the same listing. */
const lastSentAt = new Map<string, number>()
const DEDUPE_MS = 2500

/**
 * Fires Meta Pixel `ViewContent` once per real visit to a product detail page.
 * `listingId` aligns with the Meta catalog feed product id. Renders nothing.
 */
export function MetaViewContentTracker({
  listingId,
  value,
  currency = "USD",
  contentName,
}: {
  listingId: string
  value?: number | null
  currency?: string
  contentName?: string | null
}): null {
  useEffect(() => {
    const now = Date.now()
    const last = lastSentAt.get(listingId) ?? 0
    if (now - last < DEDUPE_MS) return
    lastSentAt.set(listingId, now)

    trackMetaViewContent({ contentId: listingId, value, currency, contentName })
  }, [listingId, value, currency, contentName])

  return null
}
