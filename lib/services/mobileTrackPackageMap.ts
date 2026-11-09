import type { MobilePurchaseStatusTone, MobileTrackEvent, MobileTrackPackage } from "@reswell/api-contract"
import { googleStaticMapRouteUrl } from "@/lib/maps/google-static-map-url"
import {
  trackingStatusLabel,
  trackingStatusTone,
} from "@/lib/shipping/carrier-status-display"
import type { OrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import { formatCarrierDisplayName } from "@/lib/shipping/resolve-carrier-code"
import {
  formatTrackingEventLocation,
  trackingMapDirectionsUrl,
  trackingMapPointsFromEvents,
  trackingMapSummary,
} from "@/lib/shipping/tracking-map-points"
import type { PublicOrderTrackingPage } from "@/lib/services/publicOrderTracking"
import { absoluteUrl } from "@/lib/site-metadata"

function statusTone(statusCode: string | null | undefined): MobilePurchaseStatusTone {
  const tone = trackingStatusTone(statusCode)
  if (tone === "success") return "success"
  if (tone === "warning") return "warning"
  return "neutral"
}

function toTrackEvents(detail: OrderTrackingDetail | null): MobileTrackEvent[] {
  const events: MobileTrackEvent[] = []
  for (const event of detail?.events ?? []) {
    const description = event.description?.trim() || "Tracking update"
    const occurredAt = event.occurred_at?.trim() || null
    if (!event.description?.trim() && !occurredAt) continue
    events.push({
      occurred_at: occurredAt,
      description,
      location: formatTrackingEventLocation(event),
    })
  }
  return events
}

export function toMobileTrackPackage(page: PublicOrderTrackingPage): MobileTrackPackage {
  const detail = page.detail
  const statusLabel = detail ? trackingStatusLabel(detail) : "Waiting for carrier scans"
  const carrierDescription = detail?.carrier_status_description?.trim() || null
  const terminal =
    page.deliveryStatus === "delivered" || page.deliveryStatus === "picked_up"
  const points = trackingMapPointsFromEvents(detail?.events)
  const staticMap = googleStaticMapRouteUrl(points)

  return {
    order_id: page.orderId,
    order_number: page.orderNumber,
    listing_title: page.listingTitle,
    tracking_number: page.trackingNumber,
    carrier_label: formatCarrierDisplayName(page.trackingCarrier, null),
    status_label: statusLabel,
    status_tone: statusTone(detail?.status_code),
    status_description:
      carrierDescription && carrierDescription !== statusLabel ? carrierDescription : null,
    exception_description: detail?.exception_description?.trim() || null,
    estimated_delivery_at: detail?.estimated_delivery_date?.trim() || null,
    delivered_at: detail?.actual_delivery_date?.trim() || null,
    updated_at: detail?.updated_at?.trim() || null,
    live: !terminal,
    map:
      points.length > 0
        ? {
            image_url: staticMap ? absoluteUrl(`/api/orders/${page.orderId}/tracking-map`) : null,
            open_url: trackingMapDirectionsUrl(points),
            summary: trackingMapSummary(points),
          }
        : null,
    events: toTrackEvents(detail),
  }
}
