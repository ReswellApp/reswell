"use client"

import Link from "next/link"
import { Handshake } from "lucide-react"
import { Button } from "@/components/ui/button"
import { acceptedOfferCheckoutHref } from "@/lib/listing-href"
import { formatDistanceToNow } from "date-fns"
import {
  parseCounterofferNoteFromThread,
  parseNegotiationAmountFromContent,
  type OfferNegotiationKind,
} from "@/lib/utils/parse-offer-negotiation-message"
import { BuyerCounterRespondButtons } from "@/components/features/messages/buyer-counter-respond-buttons"
import {
  THREAD_EVENT_CTA_CLASS,
  ThreadEventActions,
  ThreadEventCard,
  ThreadEventHint,
  ThreadEventLink,
  type ThreadEventTone,
} from "@/components/features/messages/thread-event-card"

function kindTone(kind: OfferNegotiationKind): ThreadEventTone {
  if (kind === "accepted") return "success"
  if (kind === "declined") return "warning"
  return "info"
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
    return "Complete checkout when you’re ready."
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
    <ThreadEventCard icon={Handshake} tone="neutral" title="Offer" createdAt={createdAt}>
      <p className="whitespace-pre-wrap break-words text-[13px] leading-snug text-foreground/85">
        {content.trim()}
      </p>
    </ThreadEventCard>
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
  offerHref,
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
  /** Dashboard URL for the offer this line describes. */
  offerHref?: string | null
  /** When set, buyer can accept/decline this open counter (or seller-initiated offer) here. */
  actionableOfferId?: string | null
  actionableExpiresAt?: string | null
  /** When set, buyer can check out the accepted offer from this card. */
  checkoutOfferId?: string | null
  checkoutLineItemCount?: number
  onThreadRefresh?: () => void | Promise<void>
}) {
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
    <ThreadEventCard
      icon={Handshake}
      tone={kindTone(kind)}
      title={headline}
      amount={amount}
      createdAt={createdAt}
    >
      {!amount ? (
        <p className="whitespace-pre-wrap break-words text-[13px] leading-snug text-foreground/85">
          {content.trim()}
        </p>
      ) : null}
      {note ? (
        <p className="text-[13px] leading-snug text-foreground/85">&ldquo;{note}&rdquo;</p>
      ) : null}
      {hint ? <ThreadEventHint>{hint}</ThreadEventHint> : null}
      {hasBuyerActions || hasCheckout ? (
        <ThreadEventActions>
          {hasBuyerActions && actionableOfferId && onThreadRefresh ? (
            <BuyerCounterRespondButtons
              offerId={actionableOfferId}
              onCompleted={onThreadRefresh}
            />
          ) : null}
          {hasCheckout && checkoutOfferId ? (
            <Button className={THREAD_EVENT_CTA_CLASS} asChild>
              <Link href={acceptedOfferCheckoutHref(checkoutOfferId)}>
                {isBundleCheckout ? `Checkout all ${bundleCount} items` : "Checkout now"}
              </Link>
            </Button>
          ) : null}
        </ThreadEventActions>
      ) : null}
      {offerHref ? (
        hasBuyerActions || hasCheckout ? (
          <p>
            <ThreadEventLink href={offerHref}>View offer</ThreadEventLink>
          </p>
        ) : (
          <ThreadEventActions>
            <Button className={THREAD_EVENT_CTA_CLASS} variant="outline" asChild>
              <Link href={offerHref}>View offer</Link>
            </Button>
          </ThreadEventActions>
        )
      ) : null}
    </ThreadEventCard>
  )
}
