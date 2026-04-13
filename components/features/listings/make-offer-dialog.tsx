"use client"

import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { HandCoins, ImageOff, Loader2 } from "lucide-react"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useOptionalAuthModal } from "@/components/auth/auth-modal-context"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import { cn } from "@/lib/utils"

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

export type MakeOfferDialogProps = {
  listingId: string
  listingTitle: string
  listPrice: number
  minOfferAmount: number
  minOfferPct: number
  primaryImageUrl: string | null
  canPick: boolean
  canShip: boolean
  shippingFlatRate: number
  isLoggedIn: boolean
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function MakeOfferDialog({
  listingId,
  listingTitle,
  listPrice,
  minOfferAmount,
  minOfferPct,
  primaryImageUrl,
  canPick,
  canShip,
  shippingFlatRate,
  isLoggedIn,
  open,
  onOpenChange,
}: MakeOfferDialogProps) {
  const router = useRouter()
  const pathname = usePathname()
  const here = pathname || "/"
  const authModal = useOptionalAuthModal()

  const [fulfillment, setFulfillment] = useState<"pickup" | "shipping">(() =>
    canShip && !canPick ? "shipping" : canPick && !canShip ? "pickup" : "shipping",
  )
  const [shippingRegion, setShippingRegion] = useState<"continental" | "alaska_hawaii" | "international">(
    "continental",
  )
  const [zipInput, setZipInput] = useState("")
  const [zipApplied, setZipApplied] = useState(false)
  const [amountInput, setAmountInput] = useState("")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setFulfillment(canShip && !canPick ? "shipping" : canPick && !canShip ? "pickup" : "shipping")
    setShippingRegion("continental")
    setZipInput("")
    setZipApplied(false)
    setAmountInput("")
    setMessage("")
    setSubmitting(false)
  }, [open, canPick, canShip])

  const offerAmount = useMemo(() => parseAmountInput(amountInput), [amountInput])

  const delivery = fulfillment === "shipping" ? Math.max(0, shippingFlatRate) : 0

  const totalPreview =
    offerAmount !== null ? roundMoney(offerAmount + delivery) : delivery > 0 ? delivery : null

  const amountValid =
    offerAmount !== null && offerAmount >= minOfferAmount && offerAmount <= listPrice

  const applyZip = useCallback(() => {
    const z = zipInput.trim()
    if (!z) {
      setZipApplied(false)
      return
    }
    if (shippingRegion === "international") {
      if (z.length < 2) {
        toast.error("Enter a postal code.")
        setZipApplied(false)
        return
      }
    } else if (!/^\d{5}(-\d{4})?$/.test(z)) {
      toast.error("Enter a valid US ZIP code (5 digits or ZIP+4).")
      setZipApplied(false)
      return
    }
    setZipApplied(true)
  }, [zipInput, shippingRegion])

  const setQuickDiscount = useCallback(
    (pctOff: number) => {
      const v = roundMoney(listPrice * (1 - pctOff / 100))
      const clamped = Math.max(minOfferAmount, Math.min(listPrice, v))
      setAmountInput(clamped.toFixed(2))
    },
    [listPrice, minOfferAmount],
  )

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!isLoggedIn) {
      const safe = safeRedirectPath(here)
      if (authModal) authModal.openLogin(here)
      else router.push(`/auth/login?redirect=${encodeURIComponent(safe)}`)
      return
    }
    if (!amountValid || offerAmount === null) {
      toast.error(`Enter an offer between $${minOfferAmount.toFixed(2)} and $${listPrice.toFixed(2)}.`)
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch(`/api/listings/${listingId}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: offerAmount,
          fulfillment,
          message: message.trim() || undefined,
          shipZip: fulfillment === "shipping" ? zipInput.trim() || undefined : undefined,
          shippingRegion: fulfillment === "shipping" ? shippingRegion : undefined,
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
      toast.success("Offer sent. The seller has been notified and can reply from their messages.")
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  const showShippingExtras = fulfillment === "shipping" && canShip
  const methodLocked = (canPick && !canShip) || (!canPick && canShip)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className="max-h-[min(90vh,720px)] w-[calc(100%-1.5rem)] max-w-md overflow-y-auto p-5 sm:p-6"
      >
        <DialogHeader className="text-center sm:text-center">
          <DialogTitle className="text-xl font-semibold">Make an Offer</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-lg border border-border/60 bg-muted/40 p-3">
            <div className="flex gap-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md border border-border/60 bg-background">
                {primaryImageUrl ? (
                  <Image
                    src={primaryImageUrl}
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
                <p className="line-clamp-2 text-sm font-semibold leading-snug">{listingTitle}</p>
              </div>
            </div>

            {showShippingExtras ? (
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    Shipping region <span className="text-destructive">*</span>
                  </Label>
                  <Select
                    value={shippingRegion}
                    onValueChange={(v) =>
                      setShippingRegion(v as "continental" | "alaska_hawaii" | "international")
                    }
                  >
                    <SelectTrigger className="h-10 bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="continental">Continental US</SelectItem>
                      <SelectItem value="alaska_hawaii">Alaska / Hawaii</SelectItem>
                      <SelectItem value="international">International</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium">
                    ZIP / Postal code <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      className="h-10 bg-background"
                      placeholder="e.g. 94102"
                      value={zipInput}
                      onChange={(e) => {
                        setZipInput(e.target.value)
                        setZipApplied(false)
                      }}
                      inputMode="numeric"
                      autoComplete="postal-code"
                    />
                    <Button type="button" variant="secondary" className="h-10 shrink-0" onClick={applyZip}>
                      Apply
                    </Button>
                  </div>
                  {zipApplied ? (
                    <p className="text-[11px] text-muted-foreground">ZIP saved for this offer.</p>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">Shipping method</Label>
            {methodLocked ? (
              <div className="rounded-md border border-input bg-muted/30 px-3 py-2 text-sm">
                {canShip && !canPick ? "Shipped" : "Local pickup"}
              </div>
            ) : (
              <Select
                value={fulfillment}
                onValueChange={(v) => setFulfillment(v as "pickup" | "shipping")}
              >
                <SelectTrigger className="h-10">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="shipping">Shipped</SelectItem>
                  <SelectItem value="pickup">Local pickup</SelectItem>
                </SelectContent>
              </Select>
            )}
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm font-semibold">
              Your offer <span className="text-destructive">*</span>
            </Label>
            <p className="text-xs text-muted-foreground">
              Minimum ${minOfferAmount.toFixed(2)} ({minOfferPct}% of ${listPrice.toFixed(2)} list price).
            </p>
            <div className="relative">
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                $
              </span>
              <Input
                className={cn("h-12 pl-7 pr-36 text-base", !amountValid && amountInput.trim() ? "border-destructive/60" : "")}
                placeholder="0.00"
                inputMode="decimal"
                value={amountInput}
                onChange={(e) => setAmountInput(e.target.value)}
                aria-invalid={!amountValid && amountInput.trim() !== ""}
              />
              {fulfillment === "shipping" && canShip ? (
                <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  + ${delivery.toFixed(2)} delivery
                </span>
              ) : null}
            </div>
            <div className="flex flex-wrap gap-2">
              {([5, 10, 15] as const).map((pct) => (
                <Button
                  key={pct}
                  type="button"
                  variant="secondary"
                  size="sm"
                  className="rounded-full"
                  onClick={() => setQuickDiscount(pct)}
                >
                  {pct}% off
                </Button>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <Label className="text-sm font-semibold">Message to seller</Label>
              <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                Optional
              </span>
            </div>
            <Textarea
              rows={3}
              maxLength={200}
              placeholder="Introduce yourself or say why you love this board."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="resize-none"
            />
            <p className="text-xs text-muted-foreground">
              Tip: Share why you’re interested or how you’ll use it.
            </p>
          </div>

          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 px-3 py-3 text-sm">
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Offer</span>
              <span>{offerAmount !== null ? `$${offerAmount.toFixed(2)}` : "—"}</span>
            </div>
            <div className="flex justify-between gap-4">
              <span className="text-muted-foreground">Delivery</span>
              <span>{fulfillment === "shipping" && canShip ? `$${delivery.toFixed(2)}` : "$0.00"}</span>
            </div>
            <div className="flex justify-between gap-4 border-t border-border/50 pt-2 font-semibold">
              <span>Total if accepted</span>
              <span>{totalPreview !== null ? `$${totalPreview.toFixed(2)}` : "—"}</span>
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed">
              Shipping uses the seller’s flat rate from the listing (same as checkout). Final taxes or
              adjustments may still apply when you pay.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={submitting || !amountValid || (showShippingExtras && !zipInput.trim())}>
              {submitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" aria-hidden />
                  Sending…
                </>
              ) : (
                "Submit offer"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function MakeOfferTriggerButton({
  className,
  disabled,
  onClick,
}: {
  className?: string
  disabled?: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="lg"
      className={cn("min-h-touch w-full gap-2 justify-center sm:w-auto", className)}
      disabled={disabled}
      onClick={onClick}
    >
      <HandCoins className="h-5 w-5 shrink-0" aria-hidden />
      Make an offer
    </Button>
  )
}
