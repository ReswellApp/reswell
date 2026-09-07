"use client"

import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { acceptedOfferCheckoutHref } from "@/lib/listing-href"
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns"
import {
  parseCounterofferNoteFromThread,
  parseNegotiationAmountFromContent,
  type OfferNegotiationKind,
} from "@/lib/utils/parse-offer-negotiation-message"
import { BuyerCounterRespondButtons } from "@/components/features/messages/buyer-counter-respond-buttons"

function formatThreadTime(dateStr: string) {
  const date = new Date(dateStr)
  if (isToday(date)) return format(date, "h:mm a")
  if (isYesterday(date)) return `Yesterday ${format(date, "h:mm a")}`
  return format(date, "MMM d, h:mm a")
}

function statusBadge(kind: OfferNegotiationKind): {
  label: string
  variant: "default" | "secondary" | "outline"
} {
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

function formatAmountLabel(amount: number | null): string | null {
  if (amount == null) return null
  return `$${amount.toFixed(2)}`
}

function headlineForKind(kind: OfferNegotiationKind, isOwn: boolean): string {
  switch (kind) {
    case "counter":
      return isOwn ? "Your counteroffer" : "Seller counteroffer"
    case "seller_offer":
      return isOwn ? "Your offer to buyer" : "Offer from seller"
    case "accepted":
      return "Offer accepted"
    case "declined":
      return "Offer declined"
  }
}

function footerHint(
  kind: OfferNegotiationKind,
  isOwn: boolean,
  hasBuyerActions: boolean,
  hasCheckout: boolean,
  expiresAt: string | null | undefined,
): string | null {
  if (hasBuyerActions && expiresAt) {
    return `Accept or decline ${formatDistanceToNow(new Date(expiresAt), { addSuffix: true })}.`
  }
  if (kind === "seller_offer" && isOwn) {
    return "Waiting for the buyer to respond to your offer."
  }
  if (kind === "seller_offer" && !isOwn) {
    return null
  }
  if (kind === "counter" && isOwn) {
    return "Waiting for the buyer to reply to your counter."
  }
  if (kind === "counter" && !isOwn) {
    return null
  }
  if (kind === "declined") {
    return "This offer is closed."
  }
  if (kind === "accepted" && hasCheckout) {
    return "Pay at your agreed price. You’re not required to complete a purchase."
  }
  if (kind === "accepted") {
    return "Next step: complete checkout when you're ready."
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
 * Buyers get Accept / Decline on open counters, and Checkout on accepted offers.
 */
export function OfferNegotiationEventCard({
  kind,
  content,
  createdAt,
  isOwn,
  showSellerDashboardLink,
  actionableOfferId,
  actionableExpiresAt,
  checkoutOfferId,
  checkoutLineItemCount,
  onThreadRefresh,
}: {
  kind: OfferNegotiationKind
  content: string
  createdAt: string
  isOwn: boolean
  /** Seller-authored outcome lines — link to offers hub */
  showSellerDashboardLink?: boolean
  /** When set, buyer can accept/decline this open counter (or seller-initiated offer) here. */
  actionableOfferId?: string | null
  actionableExpiresAt?: string | null
  /** When set, buyer can check out the accepted offer from this card. */
  checkoutOfferId?: string | null
  checkoutLineItemCount?: number
  onThreadRefresh?: () => void | Promise<void>
}) {
  const { label, variant } = statusBadge(kind)
  const hasBuyerActions = Boolean(actionableOfferId && onThreadRefresh)
  const hasCheckout = Boolean(checkoutOfferId)
  const hint = footerHint(kind, isOwn, hasBuyerActions, hasCheckout, actionableExpiresAt)
  const amount = formatAmountLabel(parseNegotiationAmountFromContent(content))
  const headline = headlineForKind(kind, isOwn)
  const note =
    kind === "seller_offer" || kind === "counter"
      ? parseCounterofferNoteFromThread(content)
      : null
  const bundleCount = checkoutLineItemCount ?? 0
  const isBundleCheckout = bundleCount > 1

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
        <p className="mt-2 text-[13px] font-medium leading-snug text-muted-foreground">{headline}</p>
        {amount ? (
          <p className="mt-1 text-[26px] font-semibold tabular-nums leading-none tracking-tight text-foreground">
            {amount}
          </p>
        ) : (
          <p className="mt-2 whitespace-pre-wrap break-words text-[15px] font-medium leading-snug text-foreground">
            {content.trim()}
          </p>
        )}
      </div>
      <div className="px-3.5 py-3">
        {note ? (
          <p className="text-[14px] leading-snug text-foreground/90">&ldquo;{note}&rdquo;</p>
        ) : null}
        {showSellerDashboardLink && (
          <p className={cn("text-[12px] leading-snug text-muted-foreground", note && "mt-2")}>
            <Link
              href="/messages/offers"
              className="font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition-colors hover:decoration-foreground/60"
            >
              View all offers
            </Link>
          </p>
        )}
        {hint && (
          <p
            className={cn(
              "text-[12px] leading-snug text-muted-foreground",
              (showSellerDashboardLink || note) && "mt-2",
            )}
          >
            {hint}
          </p>
        )}
        {hasBuyerActions && actionableOfferId && onThreadRefresh ? (
          <BuyerCounterRespondButtons
            offerId={actionableOfferId}
            onCompleted={onThreadRefresh}
            className="mt-3"
          />
        ) : null}
        {hasCheckout && checkoutOfferId ? (
          <div className="mt-3 space-y-2">
            <Button
              type="button"
              size="sm"
              className="h-10 w-full rounded-xl text-[14px] font-semibold"
              asChild
            >
              <Link href={acceptedOfferCheckoutHref(checkoutOfferId)}>
                {isBundleCheckout ? `Checkout all ${bundleCount} items` : "Checkout now"}
              </Link>
            </Button>
          </div>
        ) : null}
        <p className="mt-2.5 text-[11px] tabular-nums leading-none text-muted-foreground">
          {formatThreadTime(createdAt)}
        </p>
      </div>
    </div>
  )
}
