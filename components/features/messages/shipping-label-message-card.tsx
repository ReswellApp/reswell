"use client"

import Link from "next/link"
import { Download, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThreadTrackingDetails } from "@/components/features/messages/thread-tracking-details"
import {
  THREAD_EVENT_CTA_CLASS,
  ThreadEventActions,
  ThreadEventCard,
  ThreadEventHint,
  ThreadEventListings,
} from "@/components/features/messages/thread-event-card"
import { adminShippingLabelMessageLinks } from "@/lib/admin/admin-order-label-visibility"
import { packageTrackHref } from "@/lib/utils/carrier-tracking-url"
import type { ShippingLabelThreadPayload } from "@/lib/messages/shipping-label-thread"

function roleCopy(
  payload: ShippingLabelThreadPayload,
  viewer: "buyer" | "seller" | "admin",
  hideLabelFromSeller: boolean,
): string {
  if (viewer === "seller" && hideLabelFromSeller) {
    return "Reswell packs and ships this board from the Santa Barbara drop-off. You don’t need a shipping label."
  }
  if (viewer === "seller") {
    return payload.hasPaperlessQr
      ? "Pack the item and ship it with this label, or the USPS QR on your sale page."
      : "Pack the item and ship it with this label."
  }
  if (viewer === "buyer") {
    return payload.trackingNumber
      ? "You can track this shipment here or from your purchase."
      : "The seller has the label. Tracking will appear once the carrier scans it."
  }
  return "The carrier label is saved on this order."
}

export function ShippingLabelMessageCard({
  payload,
  createdAt,
  viewerRole,
  hideLabelFromSeller = false,
}: {
  payload: ShippingLabelThreadPayload
  createdAt?: string
  viewerRole: "buyer" | "seller" | "admin"
  /** Santa Barbara drop-off: the seller must not see or download the carrier label. */
  hideLabelFromSeller?: boolean
}) {
  const sellerLabelHidden = hideLabelFromSeller && viewerRole === "seller"
  const subtitle = payload.orderNum ? `#${payload.orderNum}` : null
  const dashboardHref =
    payload.orderId && viewerRole === "seller"
      ? `/dashboard/sales/${payload.orderId}`
      : payload.orderId && viewerRole === "buyer"
        ? `/dashboard/purchases/${payload.orderId}`
        : payload.orderId
          ? `/admin/orders/${payload.orderId}`
          : viewerRole === "seller"
            ? "/dashboard/sales"
            : viewerRole === "buyer"
              ? "/dashboard/purchases"
              : "/admin/orders"
  const dashboardLabel =
    viewerRole === "seller" ? "View sale" : viewerRole === "buyer" ? "View purchase" : "View order"
  const trackHref = packageTrackHref({
    orderId: payload.orderId,
    brandedUrl: payload.trackingUrl,
    trackingNumber: payload.trackingNumber,
    trackingCarrier: payload.trackingCarrier,
  })
  const adminLabelLinks =
    viewerRole === "admin" ? adminShippingLabelMessageLinks(payload.orderId) : null
  const canDownload =
    Boolean(adminLabelLinks) ||
    (Boolean(payload.labelPdfUrl) && viewerRole !== "buyer" && !sellerLabelHidden)

  return (
    <ThreadEventCard
      icon={Printer}
      tone="info"
      title={sellerLabelHidden ? "Santa Barbara drop-off" : "Label ready"}
      subtitle={subtitle}
      createdAt={createdAt}
    >
      {payload.listingTitle ? <ThreadEventListings titles={[payload.listingTitle]} /> : null}
      <ThreadTrackingDetails
        trackingNumber={payload.trackingNumber}
        trackingCarrier={payload.trackingCarrier}
      />
      <ThreadEventHint>{roleCopy(payload, viewerRole, sellerLabelHidden)}</ThreadEventHint>
      <ThreadEventActions>
        {canDownload && adminLabelLinks ? (
          <>
            <Button className={THREAD_EVENT_CTA_CLASS} variant="default" asChild>
              <a href={adminLabelLinks.viewHref} target="_blank" rel="noreferrer">
                <Download className="mr-1.5 h-4 w-4" aria-hidden />
                View label
              </a>
            </Button>
            <Button className={THREAD_EVENT_CTA_CLASS} variant="outline" asChild>
              <a href={adminLabelLinks.downloadHref} download>
                Download PDF
              </a>
            </Button>
          </>
        ) : canDownload && payload.labelPdfUrl ? (
          <Button className={THREAD_EVENT_CTA_CLASS} variant="default" asChild>
            <a href={payload.labelPdfUrl} target="_blank" rel="noreferrer">
              <Download className="mr-1.5 h-4 w-4" aria-hidden />
              Download label
            </a>
          </Button>
        ) : null}
        {trackHref ? (
          <Button
            className={THREAD_EVENT_CTA_CLASS}
            variant={canDownload ? "outline" : "default"}
            asChild
          >
            <a href={trackHref} target="_blank" rel="noreferrer">
              Track package
            </a>
          </Button>
        ) : null}
        <Button
          className={THREAD_EVENT_CTA_CLASS}
          variant={canDownload || trackHref ? "outline" : "default"}
          asChild
        >
          <Link href={dashboardHref}>{dashboardLabel}</Link>
        </Button>
      </ThreadEventActions>
    </ThreadEventCard>
  )
}
