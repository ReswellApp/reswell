"use client"

import Link from "next/link"
import { format, isToday, isYesterday } from "date-fns"
import { Download, Printer } from "lucide-react"
import { Button } from "@/components/ui/button"
import { ThreadTrackingDetails } from "@/components/features/messages/thread-tracking-details"
import { carrierTrackingUrl } from "@/lib/utils/carrier-tracking-url"
import { cn } from "@/lib/utils"
import type { ShippingLabelThreadPayload } from "@/lib/messages/shipping-label-thread"

function formatThreadTime(dateStr: string) {
  const date = new Date(dateStr)
  if (isToday(date)) return format(date, "h:mm a")
  if (isYesterday(date)) return `Yesterday ${format(date, "h:mm a")}`
  return format(date, "MMM d, h:mm a")
}

function roleCopy(payload: ShippingLabelThreadPayload, viewer: "buyer" | "seller" | "admin"): string {
  if (viewer === "seller") {
    return payload.hasPaperlessQr
      ? "Print the label or open the USPS QR code from your sale page, pack the item, and hand it to the carrier. Confirm drop-off when you’re done."
      : "Print the label from your sale page, pack the item, and drop it with the carrier. Confirm drop-off when you’re done."
  }
  if (viewer === "buyer") {
    return payload.trackingNumber
      ? "Tracking is on your purchase. The seller will confirm after drop-off; delivery protection and payout follow the usual timeline."
      : "The seller has the label. Tracking will show on your purchase as soon as it’s available."
  }
  return "Label and tracking are ready for this order."
}

export function ShippingLabelMessageCard({
  payload,
  createdAt,
  viewerRole,
}: {
  payload: ShippingLabelThreadPayload
  createdAt?: string
  viewerRole: "buyer" | "seller" | "admin"
}) {
  const orderLabel = payload.orderNum ? `#${payload.orderNum}` : "Shipping"
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
  const trackHref =
    payload.trackingNumber != null
      ? carrierTrackingUrl(payload.trackingNumber, payload.trackingCarrier)
      : null
  const canDownload = Boolean(payload.labelPdfUrl) && viewerRole !== "buyer"

  return (
    <div
      className={cn(
        "w-full max-w-[min(100%,20rem)] rounded-[20px] border border-border/60 bg-card p-3.5 text-foreground shadow-sm sm:max-w-[min(100%,22rem)]",
        "ring-1 ring-foreground/[0.04]",
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-sky-500/12">
          <Printer className="h-5 w-5 text-sky-700 dark:text-sky-400" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Shipping label ready
          </p>
          <p className="mt-0.5 truncate text-[17px] font-semibold leading-snug tracking-[-0.02em]">
            {orderLabel}
          </p>
        </div>
      </div>

      {payload.listingTitle ? (
        <p className="mt-3 line-clamp-3 text-[15px] leading-snug text-foreground/90">
          {payload.listingTitle}
        </p>
      ) : null}

      <ThreadTrackingDetails
        trackingNumber={payload.trackingNumber}
        trackingCarrier={payload.trackingCarrier}
      />

      <p className="mt-3 text-[14px] leading-snug text-foreground/90">
        {roleCopy(payload, viewerRole)}
      </p>

      <div className="mt-3 space-y-2">
        {canDownload && payload.labelPdfUrl ? (
          <Button className="h-10 w-full rounded-xl text-[15px] font-semibold" variant="default" asChild>
            <a href={payload.labelPdfUrl} target="_blank" rel="noreferrer">
              <Download className="mr-1.5 h-4 w-4" aria-hidden />
              Download label
            </a>
          </Button>
        ) : null}
        {trackHref && viewerRole !== "seller" ? (
          <Button
            className="h-10 w-full rounded-xl text-[15px] font-semibold"
            variant={canDownload ? "outline" : "default"}
            asChild
          >
            <a href={trackHref} target="_blank" rel="noreferrer">
              Track package
            </a>
          </Button>
        ) : null}
        <Button
          className="h-10 w-full rounded-xl text-[15px] font-semibold"
          variant={canDownload || (trackHref && viewerRole !== "seller") ? "outline" : "default"}
          asChild
        >
          <Link href={dashboardHref}>{dashboardLabel}</Link>
        </Button>
      </div>

      {createdAt ? (
        <p className="mt-2 text-[11px] tabular-nums text-muted-foreground">
          {formatThreadTime(createdAt)}
        </p>
      ) : null}
    </div>
  )
}
