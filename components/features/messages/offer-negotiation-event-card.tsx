"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { format, isToday, isYesterday } from "date-fns"
import {
  parseCounterofferNoteFromThread,
  type OfferNegotiationKind,
} from "@/lib/utils/parse-offer-negotiation-message"

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
    case "seller_offer":
      return { label: "From seller", variant: "outline" }
    case "counter":
      return { label: "Counteroffer", variant: "outline" }
  }
}

function footerHint(kind: OfferNegotiationKind, isOwn: boolean): string | null {
  if (kind === "seller_offer" && isOwn) {
    return "Waiting for the buyer to respond to your offer."
  }
  if (kind === "seller_offer" && !isOwn) {
    return "Review the offer and reply when you're ready."
  }
  if (kind === "counter" && isOwn) {
    return "Waiting for the buyer to reply to your counter."
  }
  if (kind === "counter" && !isOwn) {
    return "Review the counter and reply when you're ready."
  }
  if (kind === "declined") {
    return "This offer is closed."
  }
  if (kind === "accepted") {
    return "Next step: complete checkout from the listing when you're ready."
  }
  return null
}

function formatNegotiationBody(kind: OfferNegotiationKind, content: string): string {
  const trimmed = content.trim()
  if (kind === "seller_offer") {
    const amountMatch = /^Offer from seller:\s*(\$[\d,]+(?:\.\d{2})?)/i.exec(trimmed)
    if (amountMatch?.[1]) {
      return `Offer from seller: ${amountMatch[1]}`
    }
  }
  if (kind === "counter") {
    const amountMatch = /^Counteroffer:\s*(\$[\d,]+(?:\.\d{2})?)/i.exec(trimmed)
    if (amountMatch?.[1]) {
      return `Counteroffer: ${amountMatch[1]}`
    }
  }
  return trimmed
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
        "w-full max-w-[min(100%,20rem)] overflow-hidden rounded-[20px] border border-border/60 bg-card text-foreground shadow-sm sm:max-w-[min(100%,22rem)]",
        "ring-1 ring-foreground/[0.04]",
      )}
    >
      <div className="border-b border-border/40 bg-muted/25 px-3.5 py-2.5">
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
      </div>
      <div className="px-3.5 py-3">
        <p className="whitespace-pre-wrap break-words text-[15px] font-medium leading-snug text-foreground">
          {content.trim()}
        </p>
        <p className="mt-2.5 text-[11px] tabular-nums leading-none text-muted-foreground">
          {formatThreadTime(createdAt)}
        </p>
      </div>
    </div>
  )
}

/**
 * Renders seller (or system) negotiation outcomes in the same visual language as `OfferMessageCard`.
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
  /** Seller-authored outcome lines — link to offers hub */
  showSellerDashboardLink?: boolean
}) {
  const { label, variant } = statusBadge(kind)
  const hint = footerHint(kind, isOwn)
  const body = formatNegotiationBody(kind, content)
  const note =
    kind === "seller_offer" || kind === "counter"
      ? parseCounterofferNoteFromThread(content)
      : null

  return (
    <div
      className={cn(
        "w-full max-w-[min(100%,20rem)] overflow-hidden rounded-[20px] border border-border/60 bg-card text-foreground shadow-sm sm:max-w-[min(100%,22rem)]",
        "ring-1 ring-foreground/[0.04]",
      )}
    >
      <div className="border-b border-border/40 bg-muted/25 px-3.5 py-2.5">
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
        <p className="mt-2 whitespace-pre-wrap break-words text-[15px] font-medium leading-snug text-foreground">
          {body}
        </p>
      </div>
      <div className="px-3.5 py-3">
        {note ? (
          <p className="text-[14px] leading-snug text-foreground/90">&ldquo;{note}&rdquo;</p>
        ) : null}
        {showSellerDashboardLink && (
          <p className={cn("text-[12px] leading-snug text-muted-foreground", note && "mt-2")}>
            <Link
              href="/messages?tab=offers"
              className="font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition-colors hover:decoration-foreground/60"
            >
              View all offers
            </Link>
          </p>
        )}
        {hint && (
          <p className={cn("text-[12px] leading-snug text-muted-foreground", (showSellerDashboardLink || note) && "mt-2")}>
            {hint}
          </p>
        )}
        <p className="mt-2.5 text-[11px] tabular-nums leading-none text-muted-foreground">
          {formatThreadTime(createdAt)}
        </p>
      </div>
    </div>
  )
}
