"use client"

import { useState } from "react"
import Link from "next/link"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { BuyerCounterOfferDialog, type BuyerCounterOfferRow } from "@/components/features/offers/buyer-counter-offer-dialog"
import { resolveOfferThreadNote } from "@/lib/utils/parse-offer-negotiation-message"
import { latestSellerCounterNoteFromTimeline } from "@/lib/utils/offer-timeline"
import { buildOfferMessageDisplay } from "@/lib/utils/offer-message-display"
import { SellerOfferResponseDialog, type OfferRowLite } from "./seller-offer-response-dialog"
import { format, isToday, isYesterday, formatDistanceToNow } from "date-fns"

function statusLabel(status: string, sellerInitiated?: boolean | null): string {
  if (status === "COUNTERED" && sellerInitiated) return "From seller"
  switch (status) {
    case "PENDING":
      return "Pending"
    case "ACCEPTED":
      return "Accepted"
    case "DECLINED":
      return "Declined"
    case "COUNTERED":
      return "Countered"
    case "EXPIRED":
      return "Expired"
    case "WITHDRAWN":
      return "Withdrawn"
    case "COMPLETED":
      return "Completed"
    default:
      return status
  }
}

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "ACCEPTED") return "default"
  if (status === "DECLINED" || status === "EXPIRED" || status === "WITHDRAWN") {
    return "secondary"
  }
  if (status === "COUNTERED") return "outline"
  return "secondary"
}

function formatThreadTime(dateStr: string) {
  const date = new Date(dateStr)
  if (isToday(date)) return format(date, "h:mm a")
  if (isYesterday(date)) return `Yesterday ${format(date, "h:mm a")}`
  return format(date, "MMM d, h:mm a")
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
  const [buyerDialogOpen, setBuyerDialogOpen] = useState(false)
  const pending = offer.status === "PENDING"
  const countered = offer.status === "COUNTERED"
  const counterDeadlineMs = offer.expires_at ? new Date(offer.expires_at).getTime() : null
  const counterExpired =
    countered &&
    counterDeadlineMs !== null &&
    Number.isFinite(counterDeadlineMs) &&
    counterDeadlineMs <= Date.now()
  const showSellerActions = isSeller && pending
  const showBuyerCounterActions = !isSeller && countered && !counterExpired
  const sellerInitiated = !!offer.seller_initiated
  const display = buildOfferMessageDisplay(offer, messageContent, isSeller)
  const buyerDialogOffer: BuyerCounterOfferRow | null = showBuyerCounterActions
    ? {
        id: offer.id,
        status: offer.status,
        initial_amount: offer.initial_amount ?? offer.current_amount,
        current_amount: offer.current_amount,
        seller_counter_note:
          latestSellerCounterNoteFromTimeline(offer.offer_timeline) ??
          resolveOfferThreadNote(messageContent, offer.offer_timeline, {
            sellerInitiated: sellerInitiated,
          }),
        seller_initiated: sellerInitiated,
        expires_at: offer.expires_at ?? null,
      }
    : null

  return (
    <>
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
            <Badge variant={statusVariant(offer.status)} className="rounded-lg text-[11px] font-medium">
              {statusLabel(offer.status, offer.seller_initiated)}
            </Badge>
          </div>
          <p className="mt-2 text-[13px] font-medium leading-snug text-muted-foreground">
            {display.headline}
          </p>
          <p className="mt-1 text-[26px] font-semibold tabular-nums leading-none tracking-tight text-foreground">
            {display.amount}
          </p>
          {display.contextLine ? (
            <p className="mt-1.5 text-[12px] text-muted-foreground">{display.contextLine}</p>
          ) : null}
        </div>

        <div className="px-3.5 py-3">
          {display.note ? (
            <p className="text-[14px] leading-snug text-foreground/90">&ldquo;{display.note}&rdquo;</p>
          ) : null}

          {isSeller && (
            <p className={cn("text-[12px] leading-snug text-muted-foreground", display.note && "mt-2")}>
              <Link
                href="/messages?tab=offers"
                className="font-medium text-foreground underline decoration-foreground/25 underline-offset-2 transition-colors hover:decoration-foreground/60"
              >
                View all offers
              </Link>
            </p>
          )}

          {showSellerActions && (
            <div className="mt-3">
              <Button
                type="button"
                size="sm"
                className="h-10 w-full rounded-xl text-[14px] font-semibold"
                onClick={() => setDialogOpen(true)}
              >
                Review & respond
              </Button>
            </div>
          )}

          {!showSellerActions && isSeller && !pending && (
            <p className={cn("text-[12px] text-muted-foreground", (display.note || isSeller) && "mt-2")}>
              {offer.status === "COUNTERED"
                ? sellerInitiated
                  ? "Waiting for the buyer to respond to your offer."
                  : "Waiting for the buyer to reply to your counter."
                : "This offer is closed."}
            </p>
          )}

          {!isSeller && countered && counterExpired && (
            <p className={cn("text-[12px] text-muted-foreground", display.note && "mt-2")}>
              This offer has expired.
            </p>
          )}

          {!isSeller && countered && !counterExpired && offer.expires_at ? (
            <p className={cn("text-[12px] text-muted-foreground", display.note && "mt-2")}>
              Accept or decline {formatDistanceToNow(new Date(offer.expires_at), { addSuffix: true })}.
            </p>
          ) : null}

          {!isSeller && offer.status === "ACCEPTED" && (
            <p className={cn("text-[12px] text-muted-foreground", display.note && "mt-2")}>
              You accepted this price. Use Buy now on the listing to pay (shipping may apply).
            </p>
          )}

          {!isSeller && pending && (
            <p className={cn("text-[12px] text-muted-foreground", display.note && "mt-2")}>
              Waiting for the seller to respond.
            </p>
          )}

          {!isSeller && sellerInitiated && (
            <div
              className={cn(
                "mt-3 flex flex-col gap-2",
                showBuyerCounterActions && "sm:flex-row sm:flex-wrap sm:items-stretch",
              )}
            >
              {showBuyerCounterActions ? (
                <Button
                  type="button"
                  size="sm"
                  className="h-10 w-full rounded-xl text-[14px] font-semibold sm:min-w-[8rem] sm:flex-1"
                  onClick={() => setBuyerDialogOpen(true)}
                >
                  Accept or decline
                </Button>
              ) : null}
              <Button
                variant="outline"
                size="sm"
                className="h-10 w-full shrink-0 rounded-xl text-[14px] font-semibold sm:w-auto sm:min-w-[10rem]"
                asChild
              >
                <Link href="/messages?tab=offers">View in Offers</Link>
              </Button>
            </div>
          )}

          {!isSeller && !sellerInitiated && showBuyerCounterActions && (
            <div className="mt-3">
              <Button
                type="button"
                size="sm"
                className="h-10 w-full rounded-xl text-[14px] font-semibold sm:min-w-[8rem]"
                onClick={() => setBuyerDialogOpen(true)}
              >
                Review counteroffer
              </Button>
            </div>
          )}

          <p className="mt-2.5 text-[11px] tabular-nums leading-none text-muted-foreground">
            {formatThreadTime(createdAt)}
          </p>
        </div>
      </div>

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

      <BuyerCounterOfferDialog
        open={buyerDialogOpen}
        onOpenChange={setBuyerDialogOpen}
        offer={buyerDialogOffer}
        listingTitle={listingTitle}
        listPrice={listPrice}
        onCompleted={onThreadRefresh}
      />
    </>
  )
}
