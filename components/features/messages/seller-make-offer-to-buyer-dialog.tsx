"use client"

import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ImageOff, Loader2 } from "lucide-react"
import { toast } from "sonner"
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
import { createClient } from "@/lib/supabase/client"
import { capitalizeWords } from "@/lib/listing-labels"
import { cn } from "@/lib/utils"
import { proxiedListingImageSrc } from "@/lib/listing-media-proxy-url"

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

function parseAmountInput(raw: string): number | null {
  const t = raw.trim().replace(/[$,]/g, "")
  if (!t) return null
  const n = Number.parseFloat(t)
  if (!Number.isFinite(n) || n <= 0) return null
  return roundMoney(n)
}

export type SellerMakeOfferToBuyerDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  listingId: string
  buyerUserId: string
  listingTitle: string
  listPrice: number
  primaryImageUrl: string | null
}

export function SellerMakeOfferToBuyerDialog({
  open,
  onOpenChange,
  listingId,
  buyerUserId,
  listingTitle,
  listPrice,
  primaryImageUrl,
}: SellerMakeOfferToBuyerDialogProps) {
  const router = useRouter()
  const supabase = createClient()
  const [minPct, setMinPct] = useState(70)
  const [amountInput, setAmountInput] = useState("")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const minOfferAmount = useMemo(
    () => roundMoney(listPrice * (minPct / 100)),
    [listPrice, minPct],
  )

  const loadOfferSettings = useCallback(async () => {
    const { data } = await supabase
      .from("offer_settings")
      .select("minimum_offer_pct")
      .eq("listing_id", listingId)
      .maybeSingle()
    setMinPct(typeof data?.minimum_offer_pct === "number" ? data.minimum_offer_pct : 70)
  }, [supabase, listingId])

  useEffect(() => {
    if (!open) return
    setAmountInput("")
    setMessage("")
    setSubmitting(false)
    void loadOfferSettings()
  }, [open, loadOfferSettings])

  const offerAmount = useMemo(() => parseAmountInput(amountInput), [amountInput])
  const amountValid =
    offerAmount !== null && offerAmount >= minOfferAmount && offerAmount <= listPrice

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!amountValid || offerAmount === null) {
      toast.error(`Enter a price between $${minOfferAmount.toFixed(2)} and $${listPrice.toFixed(2)}.`)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/listings/${listingId}/seller-offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          buyerUserId,
          amount: offerAmount,
          message: message.trim() || undefined,
        }),
      })
      const json: unknown = await res.json().catch(() => ({}))
      if (!res.ok) {
        const err =
          typeof json === "object" && json !== null && "error" in json && typeof (json as { error: unknown }).error === "string"
            ? (json as { error: string }).error
            : "Could not send your offer."
        toast.error(err)
        return
      }

      const data =
        typeof json === "object" && json !== null && "data" in json
          ? (json as { data?: { conversationId?: string | null } }).data
          : undefined
      const conversationId = data?.conversationId ?? null

      onOpenChange(false)
      toast.success("Offer sent.")
      if (conversationId) {
        router.push(`/messages/${conversationId}`)
      } else {
        router.push("/messages")
      }
      router.refresh()
    } finally {
      setSubmitting(false)
    }
  }

  const title = capitalizeWords(listingTitle.trim() || "Listing")

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton className="w-[calc(100%-1.5rem)] max-w-md p-5 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-left text-xl font-semibold">Make them an offer</DialogTitle>
          <p className="text-left text-[15px] leading-snug text-muted-foreground">
            Send a price you&apos;re willing to accept. They can accept, decline, or reply in the thread.
          </p>
        </DialogHeader>

        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
            <div className="flex gap-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border/60 bg-background">
                {primaryImageUrl ? (
                  <Image
                    src={proxiedListingImageSrc(primaryImageUrl) || primaryImageUrl}
                    alt=""
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                    <ImageOff className="h-6 w-6" aria-hidden />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="line-clamp-2 text-sm font-semibold leading-snug">{title}</p>
                <p className="mt-1 text-sm tabular-nums text-muted-foreground">
                  List ${listPrice.toFixed(2)}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">
              Your offer <span className="text-destructive">*</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              Between ${minOfferAmount.toFixed(2)} and ${listPrice.toFixed(2)} ({minPct}% minimum of list).
            </p>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                className={cn(
                  "h-12 pl-7 text-base",
                  !amountValid && amountInput.trim() ? "border-destructive/60" : "",
                )}
                placeholder="0.00"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                aria-invalid={!amountValid && amountInput.trim() !== ""}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-semibold">Message</Label>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Optional
              </span>
            </div>
            <Textarea
              rows={3}
              maxLength={200}
              placeholder="e.g. I can meet locally this weekend, or answer any questions."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="resize-none"
            />
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !amountValid}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                "Send offer"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
