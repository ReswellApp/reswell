"use client"

import posthog from "posthog-js"
import { logSellFunnelEventAction } from "@/lib/actions/sellFunnelActions"
import { resolveSellEntryPoint } from "@/lib/sell-flow/sell-entry-point"
import type {
  PeerListingSection,
} from "@/lib/peer-listing-sections"
import type { SellFunnelEventInput } from "@/lib/validations/sell-funnel-event"

/**
 * Fire-and-forget sell funnel logging for client components. Never throws and
 * never blocks the UI; failures are only surfaced in development.
 * Auto-stamps `entryPoint` from the session when the caller omits it.
 */
export function logSellFunnelEvent(event: SellFunnelEventInput): void {
  const entryPoint =
    event.entryPoint ??
    (typeof window !== "undefined" ? resolveSellEntryPoint() : undefined)
  const payload: SellFunnelEventInput = entryPoint
    ? { ...event, entryPoint }
    : event

  posthog.capture(`sell_${payload.event}`, {
    listing_type: payload.listingType,
    field: payload.field,
    listing_id: payload.listingId,
    duration_ms: payload.durationMs,
    entry_point: payload.entryPoint,
  })

  void logSellFunnelEventAction(payload)
    .then((res) => {
      if ("error" in res && process.env.NODE_ENV === "development") {
        console.warn("[sell] funnel event not recorded:", res.error, payload)
      }
    })
    .catch((err) => {
      if (process.env.NODE_ENV === "development") {
        console.warn("[sell] funnel event failed:", err)
      }
    })
}

const FIELD_INTERACTED_PREFIX = "reswell.sell.funnel.fieldInteracted."

/** Once-per-session field focus/blur — feeds per-field drop-off in admin. */
export function logSellFieldInteracted(opts: {
  listingType: PeerListingSection
  field: string
}): void {
  if (typeof window === "undefined") return
  const key = `${FIELD_INTERACTED_PREFIX}${opts.listingType}.${opts.field}`
  try {
    if (sessionStorage.getItem(key) === "1") return
    sessionStorage.setItem(key, "1")
  } catch {
    /* still log once if storage fails */
  }
  logSellFunnelEvent({
    listingType: opts.listingType,
    event: "field_interacted",
    field: opts.field,
  })
}
