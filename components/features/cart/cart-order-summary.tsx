"use client"

import { useState } from "react"
import Link from "next/link"
import { ChevronRight, Truck } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

function formatMoney(n: number) {
  return n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/** Blues match `BRAND_CTA_BLUE` / `BRAND_CTA_BLUE_HOVER` in `lib/brand-colors.ts`. */
const primaryCta =
  "h-12 w-full rounded-lg border-0 bg-[#3b63e3] text-[15px] font-medium text-white shadow-sm hover:bg-[#2d54d8] dark:bg-[#3b63e3] dark:hover:bg-[#2d54d8]"

const applyBtn =
  "text-[15px] font-medium text-[#3b63e3] hover:underline dark:text-[#8ba3f5]"

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

export function CartOrderSummary({
  itemCount,
  subtotal,
  deliveryLabel,
  taxLabel,
  discountAmount,
  total,
  firstCheckoutHref,
  checkoutPending,
  deliveryNote,
}: {
  itemCount: number
  subtotal: number
  deliveryLabel: string
  taxLabel: string
  /** Absolute dollars; 0 means no discount to show as savings */
  discountAmount: number
  total: number
  firstCheckoutHref: string | null
  checkoutPending: boolean
  /** Short line for the truck callout under checkout */
  deliveryNote: string
}) {
  const [promo, setPromo] = useState("")
  const hasCheckout = Boolean(firstCheckoutHref) && itemCount > 0 && !checkoutPending

  function applyPromo() {
    const t = promo.trim()
    if (!t) {
      toast.message("Enter a code to apply")
      return
    }
    toast.info("Promo codes are not available yet.")
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
          onChange={(e) => setPromo(e.target.value)}
          className="h-11 flex-1 rounded-lg border-neutral-200 bg-white text-[15px] dark:border-white/15 dark:bg-background"
        />
        <button type="button" onClick={applyPromo} className={cn("shrink-0 px-1 py-2", applyBtn)}>
          Apply
        </button>
      </div>

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
        <span className="text-[17px] font-semibold text-neutral-900 dark:text-foreground">Total:</span>
        <span className="text-[22px] font-semibold tabular-nums tracking-tight text-neutral-950 dark:text-foreground">
          ${formatMoney(total)}
        </span>
      </div>

      {hasCheckout ? (
        <Button asChild className={cn("mt-6 gap-2 rounded-lg", primaryCta)}>
          <Link href={firstCheckoutHref!} prefetch={false}>
            Checkout
            <ChevronRight className="h-4 w-4" aria-hidden />
          </Link>
        </Button>
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
