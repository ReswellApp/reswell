"use client"

import Link from "next/link"
import { Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThreadTrackingDetails } from "@/components/features/messages/thread-tracking-details"
import {
  THREAD_EVENT_CTA_CLASS,
  ThreadEventActions,
  ThreadEventCard,
  ThreadEventHint,
  ThreadEventListings,
} from "@/components/features/messages/thread-event-card"
import { packageTrackHref } from "@/lib/utils/carrier-tracking-url"
import type { OrderShippedThreadPayload } from "@/lib/messages/order-shipped-thread"

function roleCopy(viewer: "buyer" | "seller" | "admin"): string {
  if (viewer === "seller") {
    return "The buyer can track this shipment. Payout releases after delivery is confirmed, plus a 4-day review window."
  }
  if (viewer === "buyer") {
    return "Your order is on the way. Track it here or from your purchase page."
  }
  return "This order has shipped. Tracking is below."
}

export function OrderShippedMessageCard({
  payload,
  createdAt,
  viewerRole,
}: {
  payload: OrderShippedThreadPayload
  createdAt?: string
  viewerRole: "buyer" | "seller" | "admin"
}) {
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

  return (
    <ThreadEventCard
      icon={Truck}
      tone="info"
      title="Order shipped"
      subtitle={subtitle}
      createdAt={createdAt}
    >
      {payload.listingTitle ? <ThreadEventListings titles={[payload.listingTitle]} /> : null}
      <ThreadTrackingDetails
        trackingNumber={payload.trackingNumber}
        trackingCarrier={payload.trackingCarrier}
      />
      <ThreadEventHint>{roleCopy(viewerRole)}</ThreadEventHint>
      <ThreadEventActions>
        {trackHref ? (
          <Button className={THREAD_EVENT_CTA_CLASS} asChild>
            <a href={trackHref} target="_blank" rel="noreferrer">
              Track package
            </a>
          </Button>
        ) : null}
        <Button
          className={THREAD_EVENT_CTA_CLASS}
          variant={trackHref ? "outline" : "default"}
          asChild
        >
          <Link href={dashboardHref}>{dashboardLabel}</Link>
        </Button>
      </ThreadEventActions>
    </ThreadEventCard>
  )
}
