"use client"

import Link from "next/link"
import { format, isToday, isYesterday } from "date-fns"
import { RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { OrderRefundedMessagePayload } from "@/lib/validations/order-refunded-message-metadata"

function formatThreadTime(dateStr: string) {
  const date = new Date(dateStr)
  if (isToday(date)) return format(date, "h:mm a")
  if (isYesterday(date)) return `Yesterday ${format(date, "h:mm a")}`
  return format(date, "MMM d, h:mm a")
}

export function OrderRefundedMessageCard({
  payload,
  createdAt,
  viewerIsSeller,
}: {
  payload: OrderRefundedMessagePayload
  createdAt: string
  viewerIsSeller: boolean
}) {
  const { orderId, orderNum, listingTitle, listingTitles } = payload
  const titles = listingTitles?.length ? listingTitles : [listingTitle]

  const dashboardHref = viewerIsSeller
    ? `/dashboard/sales/${orderId}`
    : `/dashboard/purchases/${orderId}`
  const ctaLabel = viewerIsSeller ? "View sale & status" : "View purchase & status"

  return (
    <div
      className={cn(
        "w-full max-w-[min(100%,20rem)] rounded-[20px] border border-border/60 bg-card p-3.5 text-foreground shadow-sm sm:max-w-[min(100%,22rem)]",
        "ring-1 ring-foreground/[0.04]",
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-amber-500/12">
          <RotateCcw className="h-5 w-5 text-amber-700 dark:text-amber-400" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Order refunded
          </p>
          <p className="mt-0.5 truncate text-[17px] font-semibold leading-snug tracking-[-0.02em]">
            #{orderNum}
          </p>
        </div>
      </div>

      {titles.length <= 1 ? (
        <p className="mt-3 line-clamp-3 text-[15px] leading-snug text-foreground/90">{titles[0]}</p>
      ) : (
        <ul className="mt-3 space-y-1 text-[15px] leading-snug text-foreground/90">
          {titles.map((title) => (
            <li key={title} className="line-clamp-2">
              {title}
            </li>
          ))}
        </ul>
      )}

      <p className="mt-3 rounded-2xl bg-muted/45 px-3 py-2.5 text-[14px] leading-snug text-foreground/90">
        {viewerIsSeller
          ? "This order was refunded. Your listing is live on Reswell again, and any earnings from this sale have been reversed."
          : "This order was refunded. The seller's listing is back on the market."}
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
