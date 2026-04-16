"use client"

import Link from "next/link"
import { format, isToday, isYesterday } from "date-fns"
import { CheckCircle2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { OrderCompletedMessagePayload } from "@/lib/validations/order-completed-message-metadata"

function formatThreadTime(dateStr: string) {
  const date = new Date(dateStr)
  if (isToday(date)) return format(date, "h:mm a")
  if (isYesterday(date)) return `Yesterday ${format(date, "h:mm a")}`
  return format(date, "MMM d, h:mm a")
}

export function OrderCompletedMessageCard({
  payload,
  createdAt,
  viewerIsSeller,
}: {
  payload: OrderCompletedMessagePayload
  createdAt: string
  viewerIsSeller: boolean
}) {
  const { orderId, orderNum, listingTitle } = payload

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
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/12">
          <CheckCircle2 className="h-5 w-5 text-emerald-700 dark:text-emerald-400" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Order completed
          </p>
          <p className="mt-0.5 truncate text-[17px] font-semibold leading-snug tracking-[-0.02em]">
            #{orderNum}
          </p>
        </div>
      </div>

      <p className="mt-3 line-clamp-3 text-[15px] leading-snug text-foreground/90">{listingTitle}</p>

      <p className="mt-3 rounded-2xl bg-muted/45 px-3 py-2.5 text-[14px] leading-snug text-foreground/90">
        {viewerIsSeller
          ? "Pickup is complete. Your sale is finalized — open your sale for receipts and status."
          : "Pickup is complete. Open your order anytime for receipts and status."}
      </p>

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
