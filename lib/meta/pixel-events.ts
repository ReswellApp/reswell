/**
 * Client-side Meta (Facebook) Pixel standard event senders.
 *
 * `content_ids` MUST be the listing UUID so events match the Meta Commerce catalog feed,
 * which keys each product on `listing.id` (see {@link file://./catalog-product.ts}).
 * Every sender no-ops safely when the pixel base snippet has not loaded.
 */

declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void
  }
}

export type MetaProductEventParams = {
  /** Listing UUID — aligns with the catalog feed product id. */
  contentId: string
  value?: number | null
  currency?: string | null
  contentName?: string | null
  /** Shared with the Conversions API event so Meta deduplicates the browser/server pair. */
  eventId?: string | null
}

function buildProductParams(params: MetaProductEventParams): Record<string, unknown> {
  const out: Record<string, unknown> = {
    content_type: "product",
    content_ids: [params.contentId],
  }

  const value = typeof params.value === "number" ? params.value : Number(params.value)
  if (Number.isFinite(value) && value > 0) {
    out.value = Math.round(value * 100) / 100
    out.currency = params.currency?.trim().toUpperCase() || "USD"
  }

  if (params.contentName?.trim()) {
    out.content_name = params.contentName.trim()
  }

  return out
}

function track(event: string, params: Record<string, unknown>, eventId?: string | null): void {
  if (typeof window === "undefined" || typeof window.fbq !== "function") return
  if (eventId?.trim()) {
    window.fbq("track", event, params, { eventID: eventId.trim() })
  } else {
    window.fbq("track", event, params)
  }
}

export function trackMetaViewContent(params: MetaProductEventParams): void {
  if (!params.contentId?.trim()) return
  track("ViewContent", buildProductParams(params), params.eventId)
}

export function trackMetaAddToCart(params: MetaProductEventParams): void {
  if (!params.contentId?.trim()) return
  track("AddToCart", buildProductParams(params), params.eventId)
}
