"use client"

import { useState } from "react"
import Link from "next/link"
import { Handshake } from "lucide-react"
import { Button } from "@/components/ui/button"
import { acceptedOfferCheckoutHref } from "@/lib/listing-href"
import { parseOfferLineItems } from "@/lib/types/offer-line-item"
import { BuyerCounterRespondButtons } from "@/components/features/messages/buyer-counter-respond-buttons"
import { OfferWithdrawButton } from "@/components/features/offers/offer-withdraw-button"
import { SellerOfferManageActions } from "@/components/features/offers/seller-offer-manage-actions"
import { offerIsBinding } from "@/lib/listing-offer-authorization"
import { resolveOfferThreadNote } from "@/lib/utils/parse-offer-negotiation-message"
import { latestSellerCounterNoteFromTimeline } from "@/lib/utils/offer-timeline"
import { buildOfferMessageDisplay } from "@/lib/utils/offer-message-display"
import { dashboardOffersPath } from "@/lib/utils/offers-dashboard-display"
import {
  THREAD_EVENT_CTA_CLASS,
  ThreadEventActions,
  ThreadEventCard,
  ThreadEventHint,
  ThreadEventLink,
  type ThreadEventTone,
} from "@/components/features/messages/thread-event-card"
import { SellerOfferResponseDialog, type OfferRowLite } from "./seller-offer-response-dialog"
import { formatDistanceToNow } from "date-fns"

function offerTone(status: string): ThreadEventTone {
  if (status === "ACCEPTED" || status === "COMPLETED") return "success"
  if (status === "DECLINED" || status === "EXPIRED" || status === "WITHDRAWN") return "warning"
  if (status === "COUNTERED" || status === "PENDING") return "info"
  return "neutral"
}

function sellerStatusHint(offer: OfferRowLite): string | null {
  if (offer.status === "PENDING") return null
  if (offer.status === "COUNTERED") {
    return offer.seller_initiated
      ? "Waiting for the buyer to respond. You can update or revoke this offer."
      : "Waiting for the buyer to reply to your counter."
  }
  if (offer.status === "ACCEPTED") {
    return offerIsBinding(offer)
      ? "This purchase is complete."
      : "Waiting for the buyer to complete checkout."
  }
  if (offer.status === "COMPLETED") return "This purchase is complete."
  return "This offer is closed."
}

export function OfferMessageCard({
  messageContent,
  offer,
  isSeller,
  listingTitle,
  listPrice,
  minOfferAmount,
  minOfferPct,
  createdAt,
  onThreadRefresh,
}: {
  messageContent: string
  offer: OfferRowLite
  isSeller: boolean
  listingTitle: string
  listPrice: number
  minOfferAmount: number
  minOfferPct: number
  createdAt: string
  onThreadRefresh: () => void | Promise<void>
}) {
  const [dialogOpen, setDialogOpen] = useState(false)
  const pending = offer.status === "PENDING"
  const countered = offer.status === "COUNTERED"
  const sellerInitiated = !!offer.seller_initiated
  const counterDeadlineMs = offer.expires_at ? new Date(offer.expires_at).getTime() : null
  const counterExpired =
    countered &&
    counterDeadlineMs !== null &&
    Number.isFinite(counterDeadlineMs) &&
    counterDeadlineMs <= Date.now()
  const showSellerActions = isSeller && pending && !sellerInitiated
  const showBuyerCounterActions = !isSeller && countered && !counterExpired
  const offerLineItems = parseOfferLineItems(offer.line_items) ?? []
  const isBundleOffer = offerLineItems.length > 1
  const display = buildOfferMessageDisplay(offer, messageContent, isSeller)
  const offerHref = dashboardOffersPath({
    role: isSeller ? "seller" : "buyer",
    offerId: offer.id,
  })
  const shownNote = showBuyerCounterActions
    ? latestSellerCounterNoteFromTimeline(offer.offer_timeline) ??
      resolveOfferThreadNote(messageContent, offer.offer_timeline, {
        sellerInitiated: sellerInitiated,
      })
    : display.note
  const subtitle = [display.contextLine, display.fulfillmentLabel].filter(Boolean).join(" · ")
  const showCheckout = !isSeller && offer.status === "ACCEPTED" && !offerIsBinding(offer)
  const hasPrimaryAction =
    showSellerActions ||
    showBuyerCounterActions ||
    showCheckout ||
    Boolean(isSeller && sellerInitiated && countered && offer.listing_id) ||
    Boolean(!isSeller && pending && offerIsBinding(offer))

  return (
    <>
      <ThreadEventCard
        icon={Handshake}
        tone={offerTone(offer.status)}
        title={display.headline}
        subtitle={subtitle || null}
        amount={display.amount}
        createdAt={createdAt}
      >
        {display.lineItems && display.lineItems.length > 1 ? (
          <ul className="space-y-1">
            {display.lineItems.map((row) => (
              <li
                key={row.listing_id}
                className="flex items-start justify-between gap-2 text-[13px] leading-snug"
              >
                <span className="min-w-0 flex-1 text-foreground/85">
                  {row.title?.trim() || "Listing"}
                </span>
                <span className="shrink-0 tabular-nums font-medium text-foreground">
                  ${row.amount.toFixed(2)}
                </span>
              </li>
            ))}
            {display.itemsSubtotal || display.shippingAmount ? (
              <li className="flex items-center justify-between gap-2 pt-1 text-[12px] text-muted-foreground">
                <span>
                  {display.itemsSubtotal ? `${display.itemsSubtotal}` : null}
                  {display.shippingAmount ? ` · Shipping ${display.shippingAmount}` : null}
                </span>
              </li>
            ) : null}
          </ul>
        ) : null}

        {shownNote ? (
          <p className="text-[13px] leading-snug text-foreground/85">&ldquo;{shownNote}&rdquo;</p>
        ) : null}

        {!showSellerActions && isSeller && !pending ? (
          <ThreadEventHint>{sellerStatusHint(offer)}</ThreadEventHint>
        ) : null}

        {!isSeller && countered && counterExpired ? (
          <ThreadEventHint>This offer has expired.</ThreadEventHint>
        ) : null}

        {!isSeller && countered && !counterExpired && offer.expires_at ? (
          <ThreadEventHint>
            Accept or decline {formatDistanceToNow(new Date(offer.expires_at), { addSuffix: true })}.
          </ThreadEventHint>
        ) : null}

        {!isSeller && pending ? (
          <ThreadEventHint>
            {offerIsBinding(offer)
              ? "We’ve reserved your payment. If they accept, this becomes your order."
              : "Waiting for the seller to respond."}
          </ThreadEventHint>
        ) : null}

        {showCheckout ? (
          <ThreadEventHint>
            {isBundleOffer
              ? "Pay for every item in this bundle in one checkout at your agreed prices."
              : "Pay at your agreed price. Choose pickup or shipping at checkout if both are offered."}
          </ThreadEventHint>
        ) : null}

        {hasPrimaryAction ? (
          <ThreadEventActions>
            {showSellerActions ? (
              <Button
                type="button"
                className={THREAD_EVENT_CTA_CLASS}
                onClick={() => setDialogOpen(true)}
              >
                Review & respond
              </Button>
            ) : null}

            {isSeller && sellerInitiated && countered && offer.listing_id ? (
              <SellerOfferManageActions
                offerId={offer.id}
                listingId={offer.listing_id}
                buyerUserId={offer.buyer_id}
                sellerUserId={offer.seller_id}
                listingTitle={listingTitle}
                listPrice={listPrice}
                onCompleted={onThreadRefresh}
              />
            ) : null}

            {showCheckout ? (
              <Button className={THREAD_EVENT_CTA_CLASS} asChild>
                <Link href={acceptedOfferCheckoutHref(offer.id)}>
                  {isBundleOffer
                    ? `Checkout all ${offerLineItems.length} items`
                    : "Checkout now"}
                </Link>
              </Button>
            ) : null}

            {!isSeller && pending && offerIsBinding(offer) ? (
              <OfferWithdrawButton
                offerId={offer.id}
                onCompleted={onThreadRefresh}
                className={THREAD_EVENT_CTA_CLASS}
              />
            ) : null}

            {showBuyerCounterActions ? (
              <BuyerCounterRespondButtons
                offerId={offer.id}
                onCompleted={onThreadRefresh}
              />
            ) : null}
          </ThreadEventActions>
        ) : null}

        {hasPrimaryAction ? (
          <p>
            <ThreadEventLink href={offerHref}>View offer</ThreadEventLink>
          </p>
        ) : (
          <ThreadEventActions>
            <Button className={THREAD_EVENT_CTA_CLASS} variant="outline" asChild>
              <Link href={offerHref}>View offer</Link>
            </Button>
          </ThreadEventActions>
        )}
      </ThreadEventCard>

      <SellerOfferResponseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        offer={offer}
        listingTitle={listingTitle}
        listPrice={listPrice}
        minOfferAmount={minOfferAmount}
        minOfferPct={minOfferPct}
        buyerNote={display.note}
        onCompleted={onThreadRefresh}
      />
    </>
  )
}
