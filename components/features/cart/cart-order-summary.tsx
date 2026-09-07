"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronRight, Loader2, Truck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { setPendingPromoCode, clearPendingPromoCode } from "@/lib/promo-pending-storage"
import { cn } from "@/lib/utils"
import { normalizeNewsletterPromoCodeInput } from "@/lib/utils/normalize-newsletter-promo-code"

function formatMoney(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Blues match {@link BRAND_CTA_BLUE} / {@link BRAND_CTA_BLUE_HOVER} in `lib/brand-colors.ts`. */
const primaryCta =
  "h-12 w-full rounded-lg border-0 bg-[#5574AD] text-[15px] font-medium text-white shadow-sm hover:bg-[#466091] dark:bg-[#5574AD] dark:hover:bg-[#466091]"

const applyBtn =
  "text-[15px] font-medium text-[#5574AD] hover:underline dark:text-[#9eb4da] disabled:opacity-50 disabled:no-underline"

type RowProps = {
  label: string
  value: string
  valueClassName?: string
}

function SummaryRow({ label, value, valueClassName }: RowProps) {
  return (
    <div className="flex items-baseline justify-between gap-4 text-[15px]">
      <span className="text-neutral-600 dark:text-neutral-400">{label}</span>
      <span className={cn("shrink-0 text-right tabular-nums text-neutral-900 dark:text-foreground", valueClassName)}>
        {value}
      </span>
    </div>
  )
}

type AppliedCartPromo = {
  code: string
  discountUsd: number
  discountPercent: number
}

export function CartOrderSummary({
  itemCount,
  subtotal,
  deliveryLabel,
  taxLabel,
  checkoutActions,
  checkoutPending,
  deliveryNote,
}: {
  itemCount: number
  subtotal: number
  deliveryLabel: string
  taxLabel: string
  checkoutActions: { href: string; label: string }[]
  checkoutPending: boolean
  /** Short line for the truck callout under checkout */
  deliveryNote: string
}) {
  const [promo, setPromo] = useState("")
  const [promoHint, setPromoHint] = useState<string | null>(null)
  const [promoError, setPromoError] = useState(false)
  const [promoApplying, setPromoApplying] = useState(false)
  const [appliedPromo, setAppliedPromo] = useState<AppliedCartPromo | null>(null)

  const discountAmount = appliedPromo?.discountUsd ?? 0
  const total = Math.max(0, subtotal - discountAmount)
  const hasCheckout = checkoutActions.length > 0 && itemCount > 0 && !checkoutPending

  async function applyPromo() {
    const t = normalizeNewsletterPromoCodeInput(promo)
    if (!t) {
      setPromoError(false)
      setPromoHint("Enter a code first")
      window.setTimeout(() => setPromoHint(null), 2500)
      return
    }
    if (itemCount <= 0 || subtotal <= 0) {
      setPromoError(true)
      setPromoHint("Add items to your cart before applying a promo code.")
      return
    }

    setPromo(t)
    setPromoApplying(true)
    setPromoHint(null)
    setPromoError(false)

    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          code: t,
          item_subtotal_usd: subtotal,
          shipping_usd: 0,
        }),
      })
      const data = (await res.json()) as {
        error?: string
        data?: {
          code: string
          discountUsd: number
          discountPercent: number
        }
      }
      if (!res.ok || !data.data) {
        setAppliedPromo(null)
        clearPendingPromoCode()
        setPromoError(true)
        setPromoHint(data.error ?? "Could not apply promo code.")
        return
      }

      const next: AppliedCartPromo = {
        code: data.data.code,
        discountUsd: data.data.discountUsd,
        discountPercent: data.data.discountPercent,
      }
      setAppliedPromo(next)
      setPromo(next.code)
      setPendingPromoCode(next.code)
      setPromoError(false)
      setPromoHint(`${next.code} applied — ${next.discountPercent}% off items. Final amount confirmed at checkout.`)
    } catch {
      setAppliedPromo(null)
      clearPendingPromoCode()
      setPromoError(true)
      setPromoHint("Could not apply promo code.")
    } finally {
      setPromoApplying(false)
    }
  }

  return (
    <div
      className={cn(
        "rounded-lg bg-[#F9FAFB] p-5 dark:bg-neutral-900/60",
        "ring-1 ring-neutral-200 dark:ring-white/10",
      )}
    >
      <div className="flex gap-2">
        <Input
          type="text"
          placeholder="Promocode"
          value={promo}
          disabled={promoApplying || Boolean(appliedPromo)}
          onChange={(e) => {
            setPromo(e.target.value)
            setPromoHint(null)
            setPromoError(false)
          }}
          onPaste={(e) => {
            const pasted = e.clipboardData.getData("text")
            if (!pasted) return
            e.preventDefault()
            setPromo(normalizeNewsletterPromoCodeInput(pasted))
            setPromoHint(null)
            setPromoError(false)
          }}
          autoComplete="off"
          spellCheck={false}
          className="h-11 flex-1 rounded-lg border-neutral-200 bg-white text-[15px] uppercase placeholder:normal-case dark:border-white/15 dark:bg-background"
          aria-label="Promo code"
        />
        <button
          type="button"
          onClick={() => void applyPromo()}
          disabled={promoApplying || Boolean(appliedPromo)}
          className={cn("shrink-0 px-1 py-2", applyBtn)}
        >
          {promoApplying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Apply"}
        </button>
      </div>
      {promoHint ? (
        <p
          className={cn(
            "mt-2 text-[13px]",
            promoError ? "text-destructive" : "text-muted-foreground",
          )}
          role={promoError ? "alert" : "status"}
        >
          {promoHint}
        </p>
      ) : (
        <p className="mt-2 text-[12px] text-muted-foreground">
          Sign in to apply. Discount is on item price only; shipping is finalized at checkout.
        </p>
      )}

      <div className="mt-6 space-y-3">
        <SummaryRow
          label={`${itemCount} ${itemCount === 1 ? "item" : "items"}:`}
          value={`$${formatMoney(subtotal)}`}
        />
        <SummaryRow label="Delivery cost:" value={deliveryLabel} />
        <SummaryRow label="Tax:" value={taxLabel} />
        <SummaryRow
          label="Discount:"
          value={
            discountAmount > 0 ? `- $${formatMoney(discountAmount)}` : "—"
          }
          valueClassName={discountAmount > 0 ? "font-medium text-[#22C55E]" : "text-neutral-500 dark:text-neutral-500"}
        />
      </div>

      <div className="my-5 h-px bg-neutral-200 dark:bg-white/10" />

      <div className="flex items-baseline justify-between gap-4">
        <span className="text-[17px] font-semibold text-foreground">Total:</span>
        <span className="text-[22px] font-semibold tabular-nums tracking-tight text-foreground">
          ${formatMoney(total)}
        </span>
      </div>

      {hasCheckout ? (
        <div className={cn("mt-6 flex flex-col gap-2", checkoutActions.length > 1 ? "gap-2.5" : "")}>
          {checkoutActions.map((action) => (
            <Button key={action.href} asChild className={cn("gap-2 rounded-lg", primaryCta)}>
              <Link href={action.href} prefetch={false}>
                {action.label}
                <ChevronRight className="h-4 w-4" aria-hidden />
              </Link>
            </Button>
          ))}
        </div>
      ) : (
        <Button disabled className={cn("mt-6 gap-2 rounded-lg opacity-50", primaryCta)}>
          Checkout
          <ChevronRight className="h-4 w-4" aria-hidden />
        </Button>
      )}

      <div
        className={cn(
          "mt-5 flex gap-3 rounded-lg bg-white p-3 text-[13px] leading-snug text-neutral-600",
          "ring-1 ring-neutral-200/80 dark:bg-neutral-950/40 dark:text-neutral-400 dark:ring-white/10",
        )}
      >
        <Truck className="mt-0.5 h-4 w-4 shrink-0 text-neutral-500" strokeWidth={1.5} aria-hidden />
        <p>{deliveryNote}</p>
      </div>
    </div>
  )
}
