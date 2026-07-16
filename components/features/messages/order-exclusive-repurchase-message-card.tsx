"use client"

import Link from "next/link"
import { format, isToday, isYesterday } from "date-fns"
import { ShoppingBag } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { listingDetailHref, peerListingCheckoutHref } from "@/lib/listing-href"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import type { PeerListingSection } from "@/lib/peer-listing-sections"

function formatThreadTime(dateStr: string) {
  const date = new Date(dateStr)
  if (isToday(date)) return format(date, "h:mm a")
  if (isYesterday(date)) return `Yesterday ${format(date, "h:mm a")}`
  return format(date, "MMM d, h:mm a")
}

function formatExclusiveUntilLabel(untilIso: string): string {
  const until = new Date(untilIso)
  if (Number.isNaN(until.getTime())) return "soon"
  return until.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "America/Los_Angeles",
  })
}

export function OrderExclusiveRepurchaseMessageCard({
  payload,
  createdAt,
  viewerIsSeller,
}: {
  payload: OrderExclusiveRepurchaseMessagePayload
  createdAt: string
  viewerIsSeller: boolean
}) {
  const { orderNum, listingTitle, listingTitles, listingId, listingSlug, listingSection, exclusiveUntil } =
    payload
  const titles = listingTitles?.length ? listingTitles : [listingTitle]
  const untilLabel = formatExclusiveUntilLabel(exclusiveUntil)
  const listingParam = listingSlug?.trim() || listingId
  const listingHref = listingDetailHref({ id: listingId, slug: listingSlug ?? null })
  const section: PeerListingSection = isPeerListingSection(listingSection ?? "")
    ? (listingSection as PeerListingSection)
    : "surfboards"
  const checkoutHref = peerListingCheckoutHref(section, listingParam)

  return (
    <div
      className={cn(
        "w-full max-w-[min(100%,20rem)] rounded-[20px] border border-border/60 bg-card p-3.5 text-foreground shadow-sm sm:max-w-[min(100%,22rem)]",
        "ring-1 ring-foreground/[0.04]",
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-sky-500/12">
          <ShoppingBag className="h-5 w-5 text-sky-700 dark:text-sky-400" strokeWidth={2} aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
            Buy again
          </p>
          <p className="mt-0.5 truncate text-[17px] font-semibold leading-snug tracking-[-0.02em]">
            Order #{orderNum}
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
          ? `This order was refunded and the listing is live again. The original buyer can repurchase exclusively through ${untilLabel}.`
          : `This order was refunded, but the listing is back on Reswell. You have exclusive access to buy it again through ${untilLabel} — other buyers cannot check out until then.`}
      </p>

      {viewerIsSeller ? (
        <Button
          className="mt-3 h-10 w-full rounded-xl text-[15px] font-semibold"
          variant="default"
          asChild
        >
          <Link href={listingHref}>View listing</Link>
        </Button>
      ) : (
        <Button
          className="mt-3 h-11 w-full rounded-xl text-[15px] font-semibold"
          variant="default"
          asChild
        >
          <Link href={checkoutHref}>Buy it now</Link>
        </Button>
      )}

      <p className="mt-2 text-[11px] tabular-nums text-muted-foreground">{formatThreadTime(createdAt)}</p>
    </div>
  )
}
