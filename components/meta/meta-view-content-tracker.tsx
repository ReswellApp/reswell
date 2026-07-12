"use client"

import { useEffect } from "react"

import { trackMetaViewContent } from "@/lib/meta/pixel-events"
import { collectMetaClientBrowserSignals } from "@/lib/meta/collect-client-browser-signals"

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

    // Shared id so the Conversions API ViewContent dedupes against this browser pixel event.
    const eventId =
      typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
        ? crypto.randomUUID()
        : `vc_${listingId}_${now}`

    trackMetaViewContent({ contentId: listingId, value, currency, contentName, eventId })

    const numericValue = typeof value === "number" && Number.isFinite(value) && value > 0 ? value : undefined
    void (async () => {
      const browserSignals = await collectMetaClientBrowserSignals().catch(() => ({
        fbc: null,
        fbp: null,
      }))
      await fetch("/api/integrations/meta/view-content", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        keepalive: true,
        body: JSON.stringify({
          listing_id: listingId,
          event_id: eventId,
          value: numericValue,
          currency: currency?.toUpperCase(),
          source_url: typeof window !== "undefined" ? window.location.href : undefined,
          fbc: browserSignals.fbc ?? undefined,
          fbp: browserSignals.fbp ?? undefined,
        }),
      }).catch(() => {})
    })()
  }, [listingId, value, currency, contentName])

  return null
}
