"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { format, isToday, isYesterday } from "date-fns"
import type { OfferNegotiationKind } from "@/lib/utils/parse-offer-negotiation-message"

function formatThreadTime(dateStr: string) {
  const date = new Date(dateStr)
  if (isToday(date)) return format(date, "h:mm a")
  if (isYesterday(date)) return `Yesterday ${format(date, "h:mm a")}`
  return format(date, "MMM d, h:mm a")
}

function statusBadge(kind: OfferNegotiationKind): { label: string; variant: "default" | "secondary" | "outline" } {
  switch (kind) {
    case "accepted":
      return { label: "Accepted", variant: "default" }
    case "declined":
      return { label: "Declined", variant: "secondary" }
    case "counter":
      return { label: "Counteroffer", variant: "outline" }
  }
}

function footerHint(kind: OfferNegotiationKind, isOwn: boolean): string | null {
  if (kind === "counter" && isOwn) {
    return "Waiting for the buyer to reply to your counter."
  }
  if (kind === "counter" && !isOwn) {
    return "Review the counter and reply when you’re ready."
  }
  if (kind === "declined") {
    return "This offer is closed."
  }
  if (kind === "accepted") {
    return "Next step: complete checkout from the listing when you’re ready."
  }
  return null
}

/** Legacy mirrored line when `messages.offer_id` was missing — same shell as other offer cards. */
export function OfferLegacyMirrorCard({
  content,
  createdAt,
}: {
  content: string
  createdAt: string
}) {
  return (
    <div
      className={cn(
        "w-full max-w-[min(100%,20rem)] rounded-[20px] border border-border/60 bg-card p-3.5 text-foreground shadow-sm sm:max-w-[min(100%,22rem)]",
        "ring-1 ring-foreground/[0.04]",
      )}
    >
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className="rounded-lg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
        >
          Offer
        </Badge>
        <Badge variant="secondary" className="rounded-lg text-[11px] font-medium">
          Sent
        </Badge>
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-[16px] font-medium leading-snug text-foreground">
        {content.trim()}
      </p>
      <p className="mt-2 text-[11px] tabular-nums leading-none text-muted-foreground">
        {formatThreadTime(createdAt)}
      </p>
    </div>
  )
}

/**
 * Renders seller (or system) negotiation outcomes in the same visual language as `OfferMessageCard`
 * — light bordered card, OFFER chip + status, body copy, footer hint, timestamp.
 */
export function OfferNegotiationEventCard({
  kind,
  content,
  createdAt,
  isOwn,
  showSellerDashboardLink,
}: {
  kind: OfferNegotiationKind
  content: string
  createdAt: string
  isOwn: boolean
  /** Seller-authored outcome lines — link to dashboard Offers hub */
  showSellerDashboardLink?: boolean
}) {
  const { label, variant } = statusBadge(kind)
  const hint = footerHint(kind, isOwn)

  return (
    <div
      className={cn(
        "w-full max-w-[min(100%,20rem)] rounded-[20px] border border-border/60 bg-card p-3.5 text-foreground shadow-sm sm:max-w-[min(100%,22rem)]",
        "ring-1 ring-foreground/[0.04]",
      )}
    >
      {showSellerDashboardLink && (
        <p className="mb-2 text-[12px] leading-snug text-muted-foreground">
          <Link
            href="/dashboard/offers?tab=received"
            className="font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition-colors hover:decoration-foreground/60"
          >
            Manage all offers in your dashboard
          </Link>
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          variant="outline"
          className="rounded-lg px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide"
        >
          Offer
        </Badge>
        <Badge variant={variant} className="rounded-lg text-[11px] font-medium">
          {label}
        </Badge>
      </div>
      <p className="mt-2 whitespace-pre-wrap break-words text-[16px] font-medium leading-snug text-foreground">
        {content.trim()}
      </p>
      {hint && <p className="mt-2 text-[12px] leading-snug text-muted-foreground">{hint}</p>}
      <p className="mt-2 text-[11px] tabular-nums leading-none text-muted-foreground">
        {formatThreadTime(createdAt)}
      </p>
    </div>
  )
}
