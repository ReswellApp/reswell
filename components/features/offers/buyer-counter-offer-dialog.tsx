"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { respondToCounterOfferAction } from "@/lib/actions/offerCounterRespond"
import { capitalizeWords } from "@/lib/listing-labels"
import { formatDistanceToNow } from "date-fns"
import { parseOfferLineItems } from "@/lib/types/offer-line-item"

export type BuyerCounterOfferRow = {
  id: string
  status: string
  initial_amount: number | string
  current_amount: number | string
  seller_counter_note?: string | null
  /** True when the seller opened negotiation (proactive offer); copy differs from a true counter. */
  seller_initiated?: boolean | null
  expires_at?: string | null
  fulfillment?: "pickup" | "shipping" | null
  shipping_amount?: number | string | null
  line_items?: unknown
}

function parseMoney(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"))
  return Math.round(n * 100) / 100
}

export function BuyerCounterOfferDialog({
  open,
  onOpenChange,
  offer,
  listingTitle,
  listPrice,
  onCompleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  offer: BuyerCounterOfferRow | null
  listingTitle: string
  listPrice: number
  onCompleted: () => void | Promise<void>
}) {
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null)

  const handleClose = (next: boolean) => {
    onOpenChange(next)
  }

  async function run(action: "accept" | "decline") {
    if (!offer) return
    setBusy(action)
    try {
      const result = await respondToCounterOfferAction({ offerId: offer.id, action })
      if ("error" in result && result.error) {
        toast.error(result.error)
        return
      }
      onOpenChange(false)
      await onCompleted()
    } finally {
      setBusy(null)
    }
  }

  if (!offer) return null

  const yourOffer = parseMoney(offer.initial_amount)
  const counter = parseMoney(offer.current_amount)
  const lineItems = parseOfferLineItems(offer.line_items) ?? []
  const shippingAmount =
    offer.shipping_amount != null ? parseMoney(offer.shipping_amount) : null
  const total =
    offer.fulfillment === "shipping" && shippingAmount != null
      ? counter + shippingAmount
      : counter
  const note = offer.seller_counter_note?.trim()
  const sellerOpened = !!offer.seller_initiated

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        showCloseButton
        className="max-h-[min(90vh,640px)] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto p-5 sm:p-6"
      >
        <DialogHeader>
          <DialogTitle className="text-left text-xl font-semibold">
            {sellerOpened ? "Offer from seller" : "Seller counteroffer"}
          </DialogTitle>
          <p className="text-left text-[15px] leading-snug text-muted-foreground">
            {capitalizeWords(listingTitle.trim() || "Listing")}
          </p>
          {offer.expires_at ? (
            <p className="text-left text-[13px] leading-snug text-muted-foreground">
              Respond {formatDistanceToNow(new Date(offer.expires_at), { addSuffix: true })}.
            </p>
          ) : null}
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              {sellerOpened ? "Their price" : "Seller&apos;s counter"}
            </p>
            <p className="mt-1 text-[28px] font-semibold tabular-nums tracking-tight text-foreground">
              ${total.toFixed(2)}
            </p>
            {offer.fulfillment === "shipping" && shippingAmount != null && shippingAmount > 0 ? (
              <p className="mt-1 text-[13px] text-muted-foreground">
                ${counter.toFixed(2)} items + ${shippingAmount.toFixed(2)} shipping
              </p>
            ) : null}
            {offer.fulfillment === "shipping" && shippingAmount == null ? (
              <p className="mt-1 text-[13px] text-muted-foreground">
                ${counter.toFixed(2)} items + Reswell shipping at checkout
              </p>
            ) : null}
            {offer.fulfillment === "shipping" && shippingAmount === 0 ? (
              <p className="mt-1 text-[13px] text-muted-foreground">
                ${counter.toFixed(2)} items · free shipping
              </p>
            ) : null}
            {offer.fulfillment === "pickup" ? (
              <p className="mt-1 text-[13px] text-muted-foreground">Local pickup</p>
            ) : null}
            {!sellerOpened ? (
              <p className="mt-2 text-[13px] text-muted-foreground">
                Your offer was ${yourOffer.toFixed(2)}
                {Number.isFinite(listPrice) && listPrice > 0
                  ? ` · List $${listPrice.toFixed(2)}`
                  : ""}
              </p>
            ) : Number.isFinite(listPrice) && listPrice > 0 ? (
              <p className="mt-2 text-[13px] text-muted-foreground">List ${listPrice.toFixed(2)}</p>
            ) : null}
          </div>

          {lineItems.length > 1 ? (
            <ul className="space-y-1.5 rounded-2xl border border-border/50 bg-muted/20 px-4 py-3">
              {lineItems.map((row) => (
                <li key={row.listing_id} className="flex justify-between gap-2 text-[14px]">
                  <span className="min-w-0 truncate text-foreground/90">
                    {row.title?.trim() || "Listing"}
                  </span>
                  <span className="shrink-0 tabular-nums font-medium">${row.amount.toFixed(2)}</span>
                </li>
              ))}
            </ul>
          ) : null}

          {note ? (
            <div className="rounded-2xl border border-border/50 bg-card px-4 py-3">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                Note from seller
              </p>
              <p className="mt-2 whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">{note}</p>
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-2">
            <Button
              type="button"
              variant="default"
              className="h-11 rounded-xl text-[15px] font-semibold"
              disabled={busy !== null}
              onClick={() => void run("accept")}
            >
              {busy === "accept" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                "Accept"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 rounded-xl border-destructive/40 text-[15px] font-semibold text-destructive hover:bg-destructive/10 hover:text-destructive"
              disabled={busy !== null}
              onClick={() => void run("decline")}
            >
              {busy === "decline" ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
              ) : (
                "Decline"
              )}
            </Button>
          </div>
        </div>

        <DialogFooter className="sm:justify-start">
          <p className="text-left text-[13px] leading-snug text-muted-foreground">
            Accepting records this agreed price for checkout if you decide to buy (shipping and taxes still
            apply at payment). You’re not required to complete a purchase.
          </p>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
