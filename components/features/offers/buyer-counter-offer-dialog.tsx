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

export type BuyerCounterOfferRow = {
  id: string
  status: string
  initial_amount: number | string
  current_amount: number | string
  seller_counter_note?: string | null
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
      toast.success(
        action === "accept"
          ? "Counteroffer accepted. You can check out at this price from messages when you’re ready—you’re not required to buy."
          : "Counteroffer declined.",
      )
      onOpenChange(false)
      await onCompleted()
    } finally {
      setBusy(null)
    }
  }

  if (!offer) return null

  const yourOffer = parseMoney(offer.initial_amount)
  const counter = parseMoney(offer.current_amount)
  const note = offer.seller_counter_note?.trim()

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        showCloseButton
        className="max-h-[min(90vh,640px)] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto p-5 sm:p-6"
      >
        <DialogHeader>
          <DialogTitle className="text-left text-xl font-semibold">Seller counteroffer</DialogTitle>
          <p className="text-left text-[15px] leading-snug text-muted-foreground">
            {capitalizeWords(listingTitle.trim() || "Listing")}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Seller&apos;s counter
            </p>
            <p className="mt-1 text-[28px] font-semibold tabular-nums tracking-tight text-foreground">
              ${counter.toFixed(2)}
            </p>
            <p className="mt-2 text-[13px] text-muted-foreground">
              Your offer was ${yourOffer.toFixed(2)}
              {Number.isFinite(listPrice) && listPrice > 0
                ? ` · List $${listPrice.toFixed(2)}`
                : ""}
            </p>
          </div>

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
