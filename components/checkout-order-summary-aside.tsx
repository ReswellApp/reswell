import Image from "next/image"
import Link from "next/link"
import type { ReactNode } from "react"
import { ImageOff, Loader2, ShoppingBag } from "lucide-react"
import { capitalizeWords } from "@/lib/listing-labels"
import { listingDetailHref } from "@/lib/listing-href"
import { listingShipFromDisplayLine } from "@/lib/listing-ship-from-display"
import { listingTitleThumbnailSrc } from "@/lib/listing-image-display"
import { listingImageShouldBypassOptimization } from "@/lib/listing-media-proxy-url"
import { resolvePayableAmount } from "@/lib/purchase-amount"
import { sellerProfileHref } from "@/lib/seller-slug"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { CheckoutListing, CheckoutSeller } from "@/components/checkout-types"

export type AppliedNewsletterPromo = {
  code: string
  discountUsd: number
  discountPercent: number
}

function sellerDisplayName(s: CheckoutSeller) {
  if (s.is_shop && s.shop_name?.trim()) return s.shop_name.trim()
  return s.display_name?.trim() || "Seller"
}

export function CheckoutOrderSummaryAside({
  listings,
  seller,
  needsShipping,
  displayTotals,
  shippingSummaryRight,
  promoCodeInput = "",
  onPromoCodeInputChange,
  onApplyPromo,
  appliedPromo = null,
  promoError = null,
  promoApplying = false,
  promoDisabled = false,
}: {
  listings: CheckoutListing[]
  seller?: CheckoutSeller | null
  needsShipping: boolean
  displayTotals: { itemPrice: number; shipping: number; total: number; discount?: number }
  shippingSummaryRight: ReactNode
  promoCodeInput?: string
  onPromoCodeInputChange?: (value: string) => void
  onApplyPromo?: () => void
  appliedPromo?: AppliedNewsletterPromo | null
  promoError?: string | null
  promoApplying?: boolean
  promoDisabled?: boolean
}) {
  const promoInteractive = Boolean(onPromoCodeInputChange && onApplyPromo)
  const fulfillmentLabel: "pickup" | "shipping" = needsShipping ? "shipping" : "pickup"

  const shipsFromLine =
    needsShipping && listings[0]
      ? listingShipFromDisplayLine(listings[0].city, listings[0].state)
      : null

  return (
    <aside
      className={cn(
        "order-1 border-b border-neutral-200 bg-[#F5F5F5] px-4 py-8 sm:px-8 lg:order-2 lg:w-[min(420px,42%)] lg:shrink-0 lg:border-b-0 lg:border-l lg:border-neutral-200 lg:px-8 lg:py-10",
        "lg:min-h-[calc(100dvh-3.5rem)]",
      )}
    >
      <div className="mx-auto max-w-[400px] lg:sticky lg:top-24 lg:mx-0">
        <div className="mb-6 flex items-center justify-between">
          <span className="text-[13px] font-medium uppercase tracking-wide text-neutral-500">Order summary</span>
          <Link
            href="/cart"
            className="flex items-center gap-1.5 text-[13px] font-medium text-[#5574AD] hover:underline"
          >
            <ShoppingBag className="h-4 w-4" aria-hidden />
            Cart
          </Link>
        </div>

        <div className="space-y-6">
          {listings.map((listing, idx) => {
            const imageUrl = listingTitleThumbnailSrc(listing.listing_images ?? null)
            const resolved = resolvePayableAmount(listing, fulfillmentLabel)
            const linePrice = resolved.ok ? resolved.itemPrice : 0
            const backHref = listingDetailHref(listing)

            return (
              <div
                key={listing.id}
                className={cn("flex gap-4", idx > 0 && "border-t border-neutral-200/90 pt-6")}
              >
                <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[8px] border border-neutral-200/80 bg-white shadow-sm">
                  {imageUrl ? (
                    <Image
                      src={imageUrl}
                      alt={capitalizeWords(listing.title)}
                      fill
                      className="object-cover"
                      sizes="72px"
                      unoptimized={listingImageShouldBypassOptimization(imageUrl)}
                      priority={idx === 0}
                    />
                  ) : (
                    <div className="flex h-full items-center justify-center bg-neutral-100">
                      <ImageOff className="h-7 w-7 text-neutral-300" aria-hidden />
                    </div>
                  )}
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-neutral-900 px-1 text-[11px] font-semibold text-white shadow-sm">
                    1
                  </span>
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <Link
                    href={backHref}
                    className="text-[15px] font-semibold leading-snug text-foreground underline-offset-2 hover:underline"
                  >
                    {capitalizeWords(listing.title)}
                  </Link>
                  <p className="mt-1 text-[13px] text-neutral-500">
                    Qty 1 · {needsShipping ? "Shipping" : "Local pickup"}
                  </p>
                  {shipsFromLine && idx === 0 ? (
                    <p className="mt-1 text-[12px] text-neutral-600">
                      <span className="text-neutral-500">Ships from </span>
                      {shipsFromLine}
                    </p>
                  ) : needsShipping && idx === 0 ? (
                    <p className="mt-1 text-[12px] text-neutral-500">
                      Ships from seller&apos;s listing location
                    </p>
                  ) : null}
                  {seller && idx === listings.length - 1 ? (
                    <p className="mt-2 text-[12px] text-neutral-500">
                      Sold by{" "}
                      <Link href={sellerProfileHref(seller)} className="font-medium text-[#5574AD] hover:underline">
                        {sellerDisplayName(seller)}
                      </Link>
                    </p>
                  ) : null}
                </div>
                <p className="shrink-0 pt-0.5 text-[15px] font-semibold tabular-nums text-foreground">
                  ${linePrice.toFixed(2)}
                </p>
              </div>
            )
          })}
        </div>

        <div className="mt-6">
          <div className="flex gap-2">
            <Input
              value={promoCodeInput}
              onChange={(e) => onPromoCodeInputChange?.(e.target.value)}
              placeholder="Discount code"
              disabled={!promoInteractive || promoDisabled || promoApplying || Boolean(appliedPromo)}
              className="h-11 min-w-0 flex-1 rounded-[6px] border-neutral-200 bg-white text-[13px] uppercase placeholder:normal-case placeholder:text-neutral-400"
              aria-label="Discount code"
            />
            <Button
              type="button"
              variant="outline"
              disabled={
                !promoInteractive ||
                promoDisabled ||
                promoApplying ||
                Boolean(appliedPromo) ||
                !promoCodeInput.trim()
              }
              onClick={onApplyPromo}
              className="h-11 shrink-0 rounded-[6px] border-neutral-200 px-4 text-[13px] font-medium"
            >
              {promoApplying ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : "Apply"}
            </Button>
          </div>
          {!promoInteractive ? (
            <p className="mt-2 text-[11px] text-neutral-400">Sign in to apply your newsletter promo code.</p>
          ) : appliedPromo ? (
            <p className="mt-2 text-[12px] font-medium text-[#5574AD]">
              {appliedPromo.code} applied — {appliedPromo.discountPercent}% off items
            </p>
          ) : promoError ? (
            <p className="mt-2 text-[12px] text-destructive" role="alert">
              {promoError}
            </p>
          ) : (
            <p className="mt-2 text-[11px] text-neutral-400">
              Newsletter codes apply to item price only. Reswell covers the discount — sellers are paid in full.
            </p>
          )}
        </div>

        <div className="mt-8 space-y-2.5 border-t border-neutral-200/90 pt-6 text-[14px]">
          <div className="flex justify-between gap-4">
            <span className="text-neutral-600">Subtotal</span>
            <span className="tabular-nums font-medium text-foreground">${displayTotals.itemPrice.toFixed(2)}</span>
          </div>
          {displayTotals.discount != null && displayTotals.discount > 0 ? (
            <div className="flex justify-between gap-4 text-[#5574AD]">
              <span>Newsletter discount</span>
              <span className="tabular-nums font-medium">−${displayTotals.discount.toFixed(2)}</span>
            </div>
          ) : null}
          <div className="flex justify-between gap-4">
            <span className="text-neutral-600">Shipping</span>
            <div className="min-w-[5rem] shrink-0 text-right text-[14px]">{shippingSummaryRight}</div>
          </div>
          <div className="flex justify-between gap-4 border-t border-neutral-200/90 pt-4 text-[16px] font-semibold">
            <span className="text-foreground">Total</span>
            <p className="tabular-nums text-foreground">
              <span className="text-[13px] font-normal text-neutral-500">USD </span>
              ${displayTotals.total.toFixed(2)}
            </p>
          </div>
        </div>
      </div>
    </aside>
  )
}
