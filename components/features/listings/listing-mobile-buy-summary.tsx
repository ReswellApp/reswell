import type { ReactNode } from "react"
import Link from "next/link"
import { Hourglass, ShieldCheck, Sparkles, Truck } from "lucide-react"
import {
  ListingDetailEngagementMetrics,
  type ListingOfferToCartProps,
} from "@/components/listing-detail-engagement-metrics"
import { ListingPdpDeliveryCaption } from "@/components/features/listings/listing-pdp-delivery-caption"
import { ListingKlarnaAsLowAs } from "@/components/features/listings/listing-klarna-as-low-as"
import { ListingPriceWithMarkdown } from "@/components/features/listings/listing-price-with-markdown"
import { listingFulfillmentPdpCopy } from "@reswell/api-contract"
const RECENTLY_LISTED_MS = 14 * 24 * 60 * 60 * 1000
const iconClassName = "mt-0.5 h-4 w-4 shrink-0 text-listingHeart"

function isRecentlyListed(value: string | number | Date | null | undefined): boolean {
  if (value == null) return false
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return false
  return Date.now() - d.getTime() < RECENTLY_LISTED_MS
}

export interface ListingMobileBuySummaryProps {
  listingId: string
  isLoggedIn: boolean
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
  offerToCart?: ListingOfferToCartProps | null
  createdAt?: string | number | Date | null
  showPurchaseProtection?: boolean
  agreedPriceUsd?: number | null
  compareAtPriceUsd?: number | null
  /** Board spec table (or similar) after the purchase actions. */
  afterPrice?: ReactNode
  children?: ReactNode
}

export function ListingMobileBuySummary({
  listingId,
  isLoggedIn,
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
  offerToCart = null,
  createdAt = null,
  showPurchaseProtection = false,
  agreedPriceUsd = null,
  compareAtPriceUsd = null,
  afterPrice = null,
  children,
}: ListingMobileBuySummaryProps) {
  const fulfillment = listingFulfillmentPdpCopy({
    pickupOffered,
    shippingOffered,
    locationLine,
    shippingLine: shippingPriceCaption,
    shippingCostMode,
    shippingFlatRate,
    isSold,
    soldShipped,
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
      <ListingDetailEngagementMetrics
        views={views}
        watchers={watchers}
        cartHolderCount={cartHolderCount}
        isSold={isSold}
        offerToCart={
          offerToCart
            ? {
                ...offerToCart,
                listPrice: offerToCart.listPrice ?? priceUsd,
              }
            : null
        }
        className="text-[13px]"
      />

      {isSold ? (
        <p className="mt-2 font-headline text-3xl font-semibold leading-none tracking-tight text-[#163060] tabular-nums">
          Sold for ${priceUsd.toFixed(2)}
        </p>
      ) : (
        <p className="mt-2 text-3xl font-bold leading-none tracking-tight text-foreground">
          <ListingPriceWithMarkdown
            priceUsd={priceUsd}
            compareAtPriceUsd={compareAtPriceUsd}
            priceClassName="text-3xl font-bold tracking-tight text-foreground tabular-nums"
            compareClassName="text-lg font-medium text-muted-foreground line-through tabular-nums"
          />
        </p>
      )}
      <ListingPdpDeliveryCaption
        isSold={isSold}
        shippingOffered={shippingOffered}
        pickupOffered={pickupOffered}
        shippingPriceCaption={shippingPriceCaption}
        locationLine={locationLine}
        compact
        className="mt-1"
      />
      {!isSold ? (
        <ListingKlarnaAsLowAs listingId={listingId} isLoggedIn={isLoggedIn} className="mt-2" />
      ) : null}
      {agreedPriceUsd != null ? (
        <p className="mt-1.5 text-[15px] font-medium text-emerald-700 dark:text-emerald-400">
          Your accepted price: ${agreedPriceUsd.toFixed(2)} at checkout
        </p>
      ) : null}
      {children ? <div className="mt-5">{children}</div> : null}
      {afterPrice ? <div className="mt-5">{afterPrice}</div> : null}

      {fulfillment || showScarcity || recentlyListed || showPurchaseProtection ? (
        <ul className="mt-5 space-y-2.5">
          {fulfillment ? (
            <li className="flex gap-2.5 text-[14px] leading-snug">
              <Truck className={iconClassName} aria-hidden />
              <p>
                <span className="font-semibold text-foreground">{fulfillment.headline}</span>
                {fulfillment.subline ? (
                  <span className="text-muted-foreground"> {fulfillment.subline}</span>
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
    </div>
  )
}
