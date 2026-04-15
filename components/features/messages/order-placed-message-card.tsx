"use client"

import Link from "next/link"
import { format, isToday, isYesterday } from "date-fns"
import { CreditCard, MapPin, Package, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { OrderPlacedMessagePayload } from "@/lib/validations/order-placed-message-metadata"

function formatThreadTime(dateStr: string) {
  const date = new Date(dateStr)
  if (isToday(date)) return format(date, "h:mm a")
  if (isYesterday(date)) return `Yesterday ${format(date, "h:mm a")}`
  return format(date, "MMM d, h:mm a")
}

function paymentLabel(method: OrderPlacedMessagePayload["paymentMethod"]): string {
  if (method === "reswell_bucks") return "Reswell Bucks"
  return "Card"
}

function fulfillmentSummary(
  fulfillment: OrderPlacedMessagePayload["fulfillment"],
  viewerIsSeller: boolean,
): { label: string; hint: string; Icon: typeof MapPin } {
  if (fulfillment === "shipping") {
    if (viewerIsSeller) {
      return {
        label: "Shipping",
        hint: "The buyer's ship-to address is saved on this sale. Mark shipped from your dashboard when you send it.",
        Icon: Truck,
      }
    }
    return {
      label: "Shipping",
      hint: "Track delivery and confirm receipt from your order dashboard once the seller ships.",
      Icon: Truck,
    }
  }
  return {
    label: "Local pickup",
    hint: "Reply in this thread to coordinate a time to meet.",
    Icon: MapPin,
  }
}

export function OrderPlacedMessageCard({
  payload,
  createdAt,
  viewerIsSeller,
}: {
  payload: OrderPlacedMessagePayload
  createdAt: string
  viewerIsSeller: boolean
}) {
  const { orderId, orderNum, listingTitle, total, fulfillment, paymentMethod } = payload
  const { label: fulfillLabel, hint: fulfillHint, Icon: FulfillIcon } = fulfillmentSummary(
    fulfillment,
    viewerIsSeller,
  )

  const dashboardHref = viewerIsSeller
    ? `/dashboard/sales/${orderId}`
    : `/dashboard/orders/${orderId}`
  const ctaLabel = viewerIsSeller ? "View sale & status" : "View order & status"

  return (
    <div
      className={cn(
        "w-full max-w-[min(100%,20rem)] rounded-[20px] border border-border/60 bg-card p-3.5 text-foreground shadow-sm sm:max-w-[min(100%,22rem)]",
        "ring-1 ring-foreground/[0.04]",
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-muted/80">
          <Package className="h-5 w-5 text-foreground/80" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Order placed
          </p>
          <p className="mt-0.5 truncate text-[17px] font-semibold leading-snug tracking-[-0.02em]">
            #{orderNum}
          </p>
        </div>
      </div>

      <p className="mt-3 line-clamp-3 text-[15px] leading-snug text-foreground/90">
        {listingTitle}
      </p>

      <p className="mt-2 text-[20px] font-semibold tabular-nums tracking-tight text-foreground">
        ${total.toFixed(2)}
      </p>

      <div className="mt-3 space-y-2 rounded-2xl bg-muted/45 px-3 py-2.5 text-[14px] leading-snug text-foreground/90">
        <div className="flex items-center gap-2">
          <CreditCard className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <span>
            Paid with <span className="font-medium text-foreground">{paymentLabel(paymentMethod)}</span>
          </span>
        </div>
        <div className="flex items-start gap-2">
          <FulfillIcon className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <div>
            <p className="font-medium text-foreground">{fulfillLabel}</p>
            <p className="mt-0.5 text-[13px] text-muted-foreground">{fulfillHint}</p>
          </div>
        </div>
      </div>

      <Button
        className="mt-3 h-10 w-full rounded-xl text-[15px] font-semibold"
        variant="default"
        asChild
      >
        <Link href={dashboardHref}>{ctaLabel}</Link>
      </Button>

      <p className="mt-2 text-[11px] tabular-nums text-muted-foreground">{formatThreadTime(createdAt)}</p>
    </div>
  )
}
