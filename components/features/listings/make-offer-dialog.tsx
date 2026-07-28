"use client"

import Image from "next/image"
import { useCallback, useEffect, useMemo, useState } from "react"
import { usePathname, useRouter } from "next/navigation"
import { AlertCircle, ImageOff, Loader2 } from "lucide-react"
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
import {
  offerShippingCostHint,
  offerShippingCostLabel,
  type OfferShippingCostMode,
} from "@/lib/offer-listing-shipping"
import { cn } from "@/lib/utils"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { peerListingItemNounForm } from "@/lib/peer-listing-item-nouns"

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

type SubmitNotice =
  | {
      kind: "duplicate_offer"
      conversationId: string | null
    }
  | {
      kind: "error"
      message: string
    }

function parseOfferSubmitResponse(json: unknown): {
  error: string
  code?: string
  conversationId?: string | null
} {
  if (typeof json !== "object" || json === null) {
    return { error: "Could not send your offer." }
  }
  const row = json as Record<string, unknown>
  const error = typeof row.error === "string" ? row.error : "Could not send your offer."
  const code = typeof row.code === "string" ? row.code : undefined
  const conversationId =
    typeof row.conversationId === "string"
      ? row.conversationId
      : row.conversationId === null
        ? null
        : undefined
  return { error, code, conversationId }
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
  shippingCostMode?: OfferShippingCostMode | null
  /** Peer section — drives placeholder copy (defaults to generic "item"). */
  section?: string | null
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
  shippingCostMode = null,
  section = null,
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
  const [amountInput, setAmountInput] = useState("")
  const [message, setMessage] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [submitNotice, setSubmitNotice] = useState<SubmitNotice | null>(null)

  useEffect(() => {
    if (!open) return
    setFulfillment(canShip && !canPick ? "shipping" : canPick && !canShip ? "pickup" : "shipping")
    setAmountInput("")
    setMessage("")
    setSubmitting(false)
    setSubmitNotice(null)
  }, [open, canPick, canShip])

  const offerAmount = useMemo(() => parseAmountInput(amountInput), [amountInput])

  const shippingLabel =
    fulfillment === "shipping" && canShip
      ? offerShippingCostLabel(shippingCostMode, shippingFlatRate)
      : null

  const knownFlatShipping =
    fulfillment === "shipping" &&
    canShip &&
    shippingCostMode === "flat" &&
    shippingFlatRate > 0
      ? shippingFlatRate
      : fulfillment === "shipping" && canShip && shippingCostMode === "free"
        ? 0
        : null

  const totalPreview =
    offerAmount !== null
      ? knownFlatShipping != null
        ? roundMoney(offerAmount + knownFlatShipping)
        : offerAmount
      : null

  const amountValid =
    offerAmount !== null && offerAmount >= minOfferAmount && offerAmount <= listPrice

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
      setSubmitNotice({
        kind: "error",
        message: `Enter an offer between $${minOfferAmount.toFixed(2)} and $${listPrice.toFixed(2)}.`,
      })
      return
    }

    setSubmitNotice(null)
    setSubmitting(true)
    try {
      const res = await fetch(`/api/listings/${listingId}/offers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: offerAmount,
          fulfillment,
          message: message.trim() || undefined,
        }),
      })
      const json: unknown = await res.json().catch(() => ({}))
      if (!res.ok) {
        const parsed = parseOfferSubmitResponse(json)
        if (parsed.code === "offer_already_open") {
          setSubmitNotice({
            kind: "duplicate_offer",
            conversationId: parsed.conversationId ?? null,
          })
          return
        }
        setSubmitNotice({ kind: "error", message: parsed.error })
        return
      }
      onOpenChange(false)
    } finally {
      setSubmitting(false)
    }
  }

  const methodLocked = (canPick && !canShip) || (!canPick && canShip)

  const duplicateOfferHref =
    submitNotice?.kind === "duplicate_offer" && submitNotice.conversationId
      ? `/messages/${submitNotice.conversationId}`
      : "/dashboard/offers"

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton
        className={cn(
          "flex w-[calc(100%-1rem)] max-h-[calc(100dvh-0.75rem)] max-w-md flex-col gap-0 overflow-hidden p-0 sm:max-h-none sm:gap-4 sm:p-6",
        )}
      >
        <DialogHeader className="shrink-0 space-y-0 px-3 pb-2 pt-3 text-center sm:px-0 sm:pb-0 sm:pt-0 sm:text-center">
          <DialogTitle className="text-base font-semibold sm:text-xl">Make an Offer</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col overflow-hidden sm:block sm:overflow-visible"
        >
          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 pb-2 sm:space-y-4 sm:overflow-visible sm:px-0 sm:pb-0">
            <div className="rounded-lg border border-border/60 bg-muted/40 p-2 sm:p-3">
              <div className="flex items-start gap-2.5">
                <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md border border-border/60 bg-background sm:h-16 sm:w-16">
                  {primaryImageUrl ? (
                    <Image
                      src={primaryImageUrl}
                      alt=""
                      fill
                      className="object-cover"
                      sizes="64px"
                      unoptimized={listingImageShouldBypassOptimization(primaryImageUrl)}
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                      <ImageOff className="h-5 w-5 sm:h-6 sm:w-6" aria-hidden />
                    </div>
                  )}
                </div>
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="line-clamp-2 text-sm font-semibold leading-snug">{listingTitle}</p>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-medium text-muted-foreground sm:text-xs">
                      Delivery
                    </Label>
                    {methodLocked ? (
                      <div className="rounded-md border border-input bg-background px-2.5 py-1.5 text-xs sm:px-3 sm:py-2 sm:text-sm">
                        {canShip && !canPick ? "Ship to me" : "Local pickup"}
                      </div>
                    ) : (
                      <Select
                        value={fulfillment}
                        onValueChange={(v) => setFulfillment(v as "pickup" | "shipping")}
                      >
                        <SelectTrigger className="h-8 bg-background text-xs sm:h-10 sm:text-sm">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {canShip ? (
                            <SelectItem value="shipping">Ship to me</SelectItem>
                          ) : null}
                          {canPick ? (
                            <SelectItem value="pickup">Local pickup</SelectItem>
                          ) : null}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              </div>
              {fulfillment === "shipping" && canShip ? (
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground sm:mt-3 sm:text-xs">
                  {offerShippingCostHint(shippingCostMode, shippingFlatRate)}
                </p>
              ) : fulfillment === "pickup" && canPick ? (
                <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground sm:mt-3 sm:text-xs">
                  You’ll arrange pickup with the seller after checkout — no shipping charged.
                </p>
              ) : null}
            </div>

            <div className="space-y-1">
              <div className="flex flex-wrap items-baseline justify-between gap-x-2 gap-y-0.5">
                <Label className="text-sm font-semibold">
                  Your offer <span className="text-destructive">*</span>
                </Label>
                <p className="text-[11px] text-muted-foreground sm:text-xs">
                  Min ${minOfferAmount.toFixed(0)} ({minOfferPct}% of ${listPrice.toFixed(0)})
                </p>
              </div>
              <div className="relative">
                <span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  $
                </span>
                <Input
                  className={cn(
                    "h-10 pl-6 pr-4 text-base sm:h-12 sm:pl-7",
                    !amountValid && amountInput.trim() ? "border-destructive/60" : "",
                  )}
                  placeholder="0.00"
                  inputMode="decimal"
                  value={amountInput}
                  onChange={(e) => {
                    setAmountInput(e.target.value)
                    if (submitNotice) setSubmitNotice(null)
                  }}
                  aria-invalid={!amountValid && amountInput.trim() !== ""}
                />
              </div>
              <div className="flex flex-wrap gap-1.5">
                {([5, 10, 15] as const).map((pct) => (
                  <Button
                    key={pct}
                    type="button"
                    variant="secondary"
                    size="sm"
                    className="h-7 rounded-full px-2.5 text-xs sm:h-8 sm:px-3 sm:text-sm"
                    onClick={() => setQuickDiscount(pct)}
                  >
                    {pct}% off
                  </Button>
                ))}
              </div>
            </div>

            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label className="text-sm font-semibold">Message</Label>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  Optional
                </span>
              </div>
              <Textarea
                rows={2}
                maxLength={200}
                placeholder={`Why you want this ${peerListingItemNounForm(section).singular}…`}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                className="min-h-[3.25rem] resize-none text-sm sm:min-h-[4.5rem]"
              />
            </div>

            <div className="rounded-lg border border-border/60 bg-muted/20 px-2.5 py-2 text-xs sm:space-y-2 sm:px-3 sm:py-3 sm:text-sm">
              <div className="flex items-center justify-between gap-3 sm:hidden">
                <span className="text-muted-foreground">
                  {shippingLabel && shippingLabel !== "Calculated at checkout"
                    ? "Item + delivery"
                    : "Your offer"}
                </span>
                <span className="font-semibold">
                  {totalPreview !== null ? `$${totalPreview.toFixed(2)}` : "—"}
                  {fulfillment === "shipping" &&
                  canShip &&
                  shippingLabel === "Calculated at checkout"
                    ? " + shipping"
                    : null}
                </span>
              </div>
              <div className="hidden sm:block">
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Offer</span>
                  <span>{offerAmount !== null ? `$${offerAmount.toFixed(2)}` : "—"}</span>
                </div>
                <div className="flex justify-between gap-4">
                  <span className="text-muted-foreground">Delivery</span>
                  <span>
                    {fulfillment === "shipping" && canShip
                      ? shippingLabel
                      : "Local pickup"}
                  </span>
                </div>
                <div className="flex justify-between gap-4 border-t border-border/50 pt-2 font-semibold">
                  <span>
                    {knownFlatShipping != null ? "Total if accepted" : "Item total if accepted"}
                  </span>
                  <span>
                    {totalPreview !== null
                      ? `$${totalPreview.toFixed(2)}${
                          fulfillment === "shipping" &&
                          canShip &&
                          shippingLabel === "Calculated at checkout"
                            ? " + shipping"
                            : ""
                        }`
                      : "—"}
                  </span>
                </div>
                <p className="text-[11px] leading-relaxed text-muted-foreground">
                  You negotiate the item price only. Checkout uses this delivery choice and the
                  listing’s shipping terms.
                </p>
              </div>
            </div>
          </div>

          {submitNotice ? (
            <div
              role="alert"
              className={cn(
                "mx-3 mb-2 rounded-lg border px-3 py-2.5 text-sm sm:mx-0",
                submitNotice.kind === "duplicate_offer"
                  ? "border-sky-200/80 bg-sky-50 text-sky-950 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-50"
                  : "border-destructive/25 bg-destructive/5 text-foreground",
              )}
            >
              <div className="flex gap-2">
                <AlertCircle
                  className={cn(
                    "mt-0.5 h-4 w-4 shrink-0",
                    submitNotice.kind === "duplicate_offer"
                      ? "text-sky-600 dark:text-sky-400"
                      : "text-destructive",
                  )}
                  aria-hidden
                />
                <div className="min-w-0 flex-1 space-y-2">
                  {submitNotice.kind === "duplicate_offer" ? (
                    <>
                      <div className="space-y-0.5">
                        <p className="font-semibold leading-snug">You already sent an offer</p>
                        <p className="text-xs leading-relaxed text-muted-foreground">
                          Your offer is waiting on the seller. Open Messages to follow up, or check Offers
                          for status.
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        className="h-8 w-full sm:w-auto"
                        onClick={() => {
                          onOpenChange(false)
                          router.push(duplicateOfferHref)
                        }}
                      >
                        {submitNotice.conversationId ? "Open messages" : "View your offers"}
                      </Button>
                    </>
                  ) : (
                    <p className="text-sm leading-snug">{submitNotice.message}</p>
                  )}
                </div>
              </div>
            </div>
          ) : null}

          <DialogFooter className="shrink-0 gap-2 border-t border-border/60 px-3 py-2.5 sm:flex-row sm:gap-2 sm:border-0 sm:px-0 sm:py-0">
            <Button
              type="button"
              variant="outline"
              className="h-10 flex-1 sm:flex-none"
              onClick={() => onOpenChange(false)}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button type="submit" className="h-10 flex-1 sm:flex-none" disabled={submitting || !amountValid}>
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
      variant="secondary"
      size="lg"
      className={cn(
        "min-h-[52px] w-full justify-center rounded-xl border-0 bg-[#f2f3f5] text-[15px] font-semibold text-foreground shadow-none hover:bg-[#e8e9ec] dark:bg-secondary dark:hover:bg-secondary/80 sm:h-auto",
        className,
      )}
      disabled={disabled}
      onClick={onClick}
    >
      Make an offer
    </Button>
  )
}
