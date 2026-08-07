"use client"

import { BadgeCheck } from "lucide-react"

import { SmoothCollapse } from "@/components/ui/smooth-collapse"
import {
  MARKETPLACE_FEE_PERCENT,
  getSellerEarnings,
} from "@/lib/seller-fees"
import { cn } from "@/lib/utils"

/** Parses the raw price input the same way `SellPriceFields` treats it. */
function parseListingPrice(raw: string): number | null {
  const t = raw.trim().replace(/,/g, "")
  if (!t) return null
  const n = Number.parseFloat(t)
  if (!Number.isFinite(n) || n < 0.01 || n > 999_999.99) return null
  return n
}

function formatUsd(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

export interface SellEarningsBreakdownProps {
  /** Raw listing-price input value (as typed). */
  listingPrice: string
  /** Reswell Seller program — fee waived; seller keeps 100%. */
  feeWaived?: boolean
  className?: string
}

/**
 * Live "you'll earn" breakdown shown as soon as a valid price is entered.
 * Turns the marketplace fee from a cash-out surprise into a selling point:
 * the split is shown up front, and Reswell absorbing card processing is
 * called out explicitly.
 */
export function SellEarningsBreakdown({
  listingPrice,
  feeWaived = false,
  className,
}: SellEarningsBreakdownProps) {
  const price = parseListingPrice(listingPrice)
  const { marketplaceFee, sellerEarnings } =
    price !== null
      ? getSellerEarnings(price, { feeWaived })
      : { marketplaceFee: 0, sellerEarnings: 0 }

  return (
    <SmoothCollapse open={price !== null} className={className}>
      <div className="rounded-lg border border-listingHeart/25 bg-listingHeart/[0.04] p-4">
        <div className="flex items-baseline justify-between gap-3">
          <span className="text-sm font-semibold text-foreground">You&rsquo;ll earn</span>
          <span className="text-lg font-bold tabular-nums text-listingHeart">
            {formatUsd(sellerEarnings)}
          </span>
        </div>

        <dl className="mt-3 space-y-1.5 border-t border-listingHeart/15 pt-3 text-sm">
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">Listing price</dt>
            <dd className="tabular-nums text-foreground">{formatUsd(price ?? 0)}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-3">
            <dt className="text-muted-foreground">
              {feeWaived
                ? "Reswell fee (waived)"
                : `Reswell fee (${MARKETPLACE_FEE_PERCENT}%)`}
            </dt>
            <dd className={cn("tabular-nums", feeWaived ? "text-muted-foreground" : "text-foreground")}>
              {feeWaived ? formatUsd(0) : `−${formatUsd(marketplaceFee)}`}
            </dd>
          </div>
        </dl>

        <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-muted-foreground">
          <BadgeCheck className="mt-0.5 size-3.5 shrink-0 text-listingHeart" aria-hidden />
          <span>
            Payment processing is on us, and shipping is paid by the buyer — the fee is the only
            deduction.
          </span>
        </p>
      </div>
    </SmoothCollapse>
  )
}
