import { getGa4MeasurementId } from "@/lib/google-analytics/config"

export type PartnerEmbedClickType = "logo" | "listing" | "browse_cta"

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void
  }
}

function gtagSafe(...args: unknown[]): void {
  if (typeof window === "undefined") return
  if (typeof window.gtag !== "function") return
  window.gtag(...args)
}

/** Outbound click from a partner listing embed (logo, listing tile, or browse CTA). */
export function trackPartnerEmbedClick(params: {
  embedSlug: string
  linkType: PartnerEmbedClickType
  linkUrl: string
  listingId?: string
}): void {
  const measurementId = getGa4MeasurementId()
  if (!measurementId) return

  gtagSafe("event", "partner_embed_click", {
    send_to: measurementId,
    embed_slug: params.embedSlug,
    link_type: params.linkType,
    link_url: params.linkUrl,
    ...(params.listingId ? { listing_id: params.listingId } : {}),
    transport_type: "beacon",
  })
}
