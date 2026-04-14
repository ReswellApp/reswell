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
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { respondToOfferAction } from "@/lib/actions/offerRespond"
import { capitalizeWords } from "@/lib/listing-labels"
import { cn } from "@/lib/utils"

export type OfferRowLite = {
  id: string
  status: string
  current_amount: number | string
  buyer_id: string
  seller_id: string
}

function parseMoney(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? "0"))
  return Math.round(n * 100) / 100
}

export function SellerOfferResponseDialog({
  open,
  onOpenChange,
  offer,
  listingTitle,
  listPrice,
  minOfferAmount,
  minOfferPct,
  onCompleted,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  offer: OfferRowLite | null
  listingTitle: string
  listPrice: number
  minOfferAmount: number
  minOfferPct: number
  onCompleted: () => void | Promise<void>
}) {
  const [counterAmount, setCounterAmount] = useState("")
  const [counterNote, setCounterNote] = useState("")
  const [busy, setBusy] = useState<"accept" | "decline" | "counter" | null>(null)

  const current = offer ? parseMoney(offer.current_amount) : 0

  const resetForm = () => {
    setCounterAmount("")
    setCounterNote("")
  }

  const handleClose = (next: boolean) => {
    if (!next) resetForm()
    onOpenChange(next)
  }

  async function run(action: "accept" | "decline" | "counter") {
    if (!offer) return
    setBusy(action)
    try {
      const payload =
        action === "counter"
          ? {
              offerId: offer.id,
              action: "counter" as const,
              counterAmount: parseFloat(counterAmount.replace(/[$,]/g, "")),
              counterNote: counterNote.trim() || undefined,
            }
          : { offerId: offer.id, action }

      const result = await respondToOfferAction(payload)
      if ("error" in result && result.error) {
        toast.error(result.error)
        return
      }
      toast.success(
        action === "accept"
          ? "Offer accepted."
          : action === "decline"
            ? "Offer declined."
            : "Counter sent to the buyer.",
      )
      resetForm()
      onOpenChange(false)
      await onCompleted()
    } finally {
      setBusy(null)
    }
  }

  if (!offer) return null

  const counterNum = parseFloat(counterAmount.replace(/[$,]/g, ""))
  const counterValid =
    Number.isFinite(counterNum) &&
    counterNum > current &&
    counterNum <= listPrice &&
    counterNum >= minOfferAmount

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent
        showCloseButton
        className="max-h-[min(90vh,640px)] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto p-5 sm:p-6"
      >
        <DialogHeader>
          <DialogTitle className="text-left text-xl font-semibold">Offer details</DialogTitle>
          <p className="text-left text-[15px] leading-snug text-muted-foreground">
            {capitalizeWords(listingTitle.trim() || "Listing")}
          </p>
        </DialogHeader>

        <div className="space-y-4 py-1">
          <div className="rounded-2xl border border-border/60 bg-muted/30 px-4 py-3">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
              Current offer
            </p>
            <p className="mt-1 text-[28px] font-semibold tabular-nums tracking-tight text-foreground">
              ${current.toFixed(2)}
            </p>
            <p className="mt-2 text-[13px] text-muted-foreground">
              List ${listPrice.toFixed(2)} · Minimum offer ${minOfferAmount.toFixed(2)} (
              {minOfferPct}%)
            </p>
          </div>

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

          <div className="rounded-2xl border border-border/50 bg-card p-4">
            <Label htmlFor="counter-amt" className="text-[13px] font-semibold text-foreground">
              Counter offer
            </Label>
            <p className="mt-1 text-[13px] leading-snug text-muted-foreground">
              Must be above ${current.toFixed(2)}, between ${minOfferAmount.toFixed(2)} and $
              {listPrice.toFixed(2)}.
            </p>
            <div className="relative mt-3">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[15px] text-muted-foreground">
                $
              </span>
              <Input
                id="counter-amt"
                inputMode="decimal"
                placeholder="0.00"
                value={counterAmount}
                onChange={(e) => setCounterAmount(e.target.value)}
                className={cn("h-11 rounded-xl pl-7 text-[17px] tabular-nums")}
                disabled={busy !== null}
              />
            </div>
            <Label htmlFor="counter-note" className="mt-4 block text-[13px] font-semibold">
              Note <span className="font-normal text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="counter-note"
              value={counterNote}
              onChange={(e) => setCounterNote(e.target.value)}
              maxLength={200}
              rows={3}
              placeholder="Shipping, timing, or other terms…"
              className="mt-2 resize-none rounded-xl text-[15px]"
              disabled={busy !== null}
            />
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            type="button"
            variant="secondary"
            className="h-11 w-full rounded-xl text-[15px] font-semibold"
            disabled={busy !== null || !counterValid}
            onClick={() => void run("counter")}
          >
            {busy === "counter" ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            ) : (
              "Send counteroffer"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
