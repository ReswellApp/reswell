import type { ReactNode } from "react"
import Link from "next/link"
import { Hourglass, ShieldCheck, Sparkles, Truck } from "lucide-react"
import { ListingDetailEngagementMetrics } from "@/components/listing-detail-engagement-metrics"
import { ListingKlarnaAsLowAs } from "@/components/features/listings/listing-klarna-as-low-as"
import { formatHomePeerListingConditionLine } from "@/lib/listing-labels"

const RECENTLY_LISTED_MS = 14 * 24 * 60 * 60 * 1000
const iconClassName = "mt-0.5 h-4 w-4 shrink-0 text-listingHeart"

function isRecentlyListed(value: string | number | Date | null | undefined): boolean {
  if (value == null) return false
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return false
  return Date.now() - d.getTime() < RECENTLY_LISTED_MS
}

function priceShippingNote(caption: string | null): string | null {
  if (!caption) return null
  if (caption === "Free shipping included") return "Free Shipping"
  if (caption === "Local pickup · shipping not offered") return "Local pickup"
  if (caption === "Shipping rate calculated at checkout") return "Shipping calculated at checkout"
  return caption
}

function shippingStatusRow({
  isSold,
  soldShipped,
  shippingOffered,
  pickupOffered,
  shippingCostMode,
  shippingFlatRate,
  locationLine,
}: {
  isSold: boolean
  soldShipped: boolean
  shippingOffered: boolean
  pickupOffered: boolean
  shippingCostMode: "reswell" | "flat" | "free" | null
  shippingFlatRate: number
  locationLine: string | null
}): { title: string; detail: string | null } | null {
  if (isSold) {
    return soldShipped ? { title: "This item was shipped", detail: null } : null
  }
  const from = locationLine ? `from ${locationLine}` : null
  if (shippingOffered && shippingCostMode === "free") {
    return { title: "Free Shipping", detail: from }
  }
  if (!shippingOffered && pickupOffered) {
    return { title: "Local pickup", detail: from }
  }
  if (shippingOffered && shippingFlatRate > 0) {
    return { title: "Shipping", detail: [`+ $${shippingFlatRate.toFixed(2)}`, from].filter(Boolean).join(" ") }
  }
  if (shippingOffered && shippingCostMode === "reswell") {
    return { title: "Shipping", detail: ["calculated at checkout", from].filter(Boolean).join(" ") }
  }
  if (shippingOffered) {
    return { title: "Shipping", detail: from }
  }
  return null
}

export interface ListingMobileBuySummaryProps {
  listingId: string
  isLoggedIn: boolean
  condition?: string | null
  priceUsd: number
  isSold: boolean
  soldShipped?: boolean
  shippingPriceCaption?: string | null
  shippingOffered: boolean
  pickupOffered: boolean
  shippingCostMode?: "reswell" | "flat" | "free" | null
  shippingFlatRate?: number
  locationLine?: string | null
  showScarcity?: boolean
  views?: number
  watchers?: number
  cartHolderCount?: number
  createdAt?: string | number | Date | null
  showPurchaseProtection?: boolean
  agreedPriceUsd?: number | null
  children?: ReactNode
}

export function ListingMobileBuySummary({
  listingId,
  isLoggedIn,
  condition,
  priceUsd,
  isSold,
  soldShipped = false,
  shippingPriceCaption = null,
  shippingOffered,
  pickupOffered,
  shippingCostMode = null,
  shippingFlatRate = 0,
  locationLine = null,
  showScarcity = false,
  views = 0,
  watchers = 0,
  cartHolderCount = 0,
  createdAt = null,
  showPurchaseProtection = false,
  agreedPriceUsd = null,
  children,
}: ListingMobileBuySummaryProps) {
  const conditionLine = formatHomePeerListingConditionLine(condition)?.replace(" — ", " – ") ?? null
  const shippingNote = isSold ? null : priceShippingNote(shippingPriceCaption)
  const shippingRow = shippingStatusRow({
    isSold,
    soldShipped,
    shippingOffered,
    pickupOffered,
    shippingCostMode,
    shippingFlatRate,
    locationLine,
  })
  const recentlyListed = !isSold && isRecentlyListed(createdAt)
  const cartDetail =
    cartHolderCount === 1
      ? "1 other person has this in their cart"
      : cartHolderCount > 1
        ? `${cartHolderCount} other people have this in their cart`
        : null

  return (
    <div className="min-w-0">
      {conditionLine ? (
        <div>
          <span className="inline-flex items-center rounded-md bg-muted px-2 py-1 text-[13px] text-muted-foreground">
            <span className="border-b border-dashed border-muted-foreground/55 pb-px">{conditionLine}</span>
          </span>
        </div>
      ) : null}
      <ListingDetailEngagementMetrics
        views={views}
        watchers={watchers}
        cartHolderCount={cartHolderCount}
        isSold={isSold}
        className="mt-1.5 text-[13px]"
      />

      {isSold ? (
        <p className="mt-2 font-headline text-3xl font-semibold leading-none tracking-tight text-[#163060] tabular-nums">
          Sold for ${priceUsd.toFixed(2)}
        </p>
      ) : (
        <p className="mt-2 text-3xl font-bold leading-none tracking-tight text-foreground tabular-nums">
          ${priceUsd.toFixed(2)}
        </p>
      )}
      {shippingNote ? <p className="mt-1 text-[14px] text-muted-foreground">{shippingNote}</p> : null}
      {!isSold ? (
        <ListingKlarnaAsLowAs listingId={listingId} isLoggedIn={isLoggedIn} className="mt-2" />
      ) : null}
      {agreedPriceUsd != null ? (
        <p className="mt-1.5 text-[15px] font-medium text-emerald-700 dark:text-emerald-400">
          Your accepted price: ${agreedPriceUsd.toFixed(2)} at checkout
        </p>
      ) : null}

      {shippingRow || showScarcity || recentlyListed || showPurchaseProtection ? (
        <ul className="mt-3 space-y-2.5">
          {shippingRow ? (
            <li className="flex gap-2.5 text-[14px] leading-snug">
              <Truck className={iconClassName} aria-hidden />
              <p>
                <span className="font-semibold text-foreground">{shippingRow.title}</span>
                {shippingRow.detail ? (
                  <span className="text-muted-foreground"> {shippingRow.detail}</span>
                ) : null}
              </p>
            </li>
          ) : null}
          {showScarcity ? (
            <li className="flex gap-2.5 text-[14px] leading-snug">
              <Hourglass className={iconClassName} aria-hidden />
              <p>
                <span className="font-semibold text-foreground">Only one available</span>
                {cartDetail ? <span className="text-muted-foreground"> {cartDetail}</span> : null}
              </p>
            </li>
          ) : null}
          {recentlyListed ? (
            <li className="flex gap-2.5 text-[14px] leading-snug">
              <Sparkles className={iconClassName} aria-hidden />
              <p>
                <span className="border-b border-dashed border-muted-foreground/55 pb-px font-semibold text-foreground">
                  Recently Listed
                </span>
              </p>
            </li>
          ) : null}
          {showPurchaseProtection ? (
            <li className="flex gap-2.5 text-[14px] leading-snug">
              <ShieldCheck className={iconClassName} aria-hidden />
              <p>
                <Link
                  href="/protection-policy"
                  className="border-b border-dashed border-muted-foreground/55 pb-px font-semibold text-foreground hover:no-underline"
                >
                  Purchase Protection
                </Link>
                <span className="text-muted-foreground"> on eligible checkout</span>
              </p>
            </li>
          ) : null}
        </ul>
      ) : null}

      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  )
}
