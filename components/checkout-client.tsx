"use client"

import Image from "next/image"
import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import { CheckoutPurchaseDetails, type PurchaseDetailsState } from "@/components/checkout-purchase-details"
import { PurchaseOptions } from "@/components/purchase-options"
import { ProtectionTrustBlock } from "@/components/protection-trust-block"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { resolvePayableAmount, type PayableListing } from "@/lib/purchase-amount"
import { listingDetailHref } from "@/lib/listing-href"
import { capitalizeWords } from "@/lib/listing-labels"
import type { ProfileAddressRow } from "@/lib/profile-address"
import { sellerProfileHref } from "@/lib/seller-slug"
import { ImageOff, Truck, MapPin, ShoppingBag } from "lucide-react"
import { cn } from "@/lib/utils"

const SURFBOARD_COPY = {
  itemLineLabel: "Board",
  inspectNoun: "board",
  priceContextNoun: "board",
} as const

/** Line-item labels for peer surfboard checkout (optional overrides). */
export type CheckoutCopy = {
  itemLineLabel: string
  inspectNoun: string
  /** e.g. "board" / "item" — used in "the ___ price only" */
  priceContextNoun: string
}

export type CheckoutListing = PayableListing & {
  id: string
  slug?: string | null
  title: string
  user_id: string
  section: string
  listing_images?: Array<{ url: string; is_primary: boolean | null }> | null
}

export type CheckoutSeller = {
  display_name: string | null
  avatar_url: string | null
  seller_slug: string | null
  shop_name: string | null
  is_shop: boolean | null
}

function primaryListingImageUrl(images: CheckoutListing["listing_images"]): string | null {
  if (!images?.length) return null
  const primary = images.find((i) => i.is_primary)
  return (primary ?? images[0]).url
}

interface CheckoutClientProps {
  listing: CheckoutListing
  /** Optional overrides for checkout headings and helper text (peer surfboard flow). */
  copy?: CheckoutCopy
  buyerEmail?: string | null
  initialAddresses: ProfileAddressRow[]
  seller?: CheckoutSeller | null
}

function sellerDisplayName(s: CheckoutSeller) {
  if (s.is_shop && s.shop_name?.trim()) return s.shop_name.trim()
  return s.display_name?.trim() || "Seller"
}

export function CheckoutClient({
  listing,
  copy = SURFBOARD_COPY,
  buyerEmail,
  initialAddresses,
  seller,
}: CheckoutClientProps) {
  const canPick = listing.local_pickup !== false
  const canShip = !!listing.shipping_available

  const [method, setMethod] = useState<"pickup" | "shipping">(() => {
    if (canPick && !canShip) return "pickup"
    if (!canPick && canShip) return "shipping"
    return "pickup"
  })

  const fulfillmentForApi = canPick && canShip ? method : undefined

  const impliedFulfillment: "pickup" | "shipping" =
    canPick && canShip ? method : !canPick && canShip ? "shipping" : "pickup"

  const resolved = useMemo(() => {
    return resolvePayableAmount(listing, impliedFulfillment)
  }, [listing, impliedFulfillment])

  const [purchaseDetails, setPurchaseDetails] = useState<PurchaseDetailsState>({
    readyToPay: false,
    shippingAddressId: null,
  })

  const handlePurchaseDetailsChange = useCallback((state: PurchaseDetailsState) => {
    setPurchaseDetails(state)
  }, [])

  const backHref = listingDetailHref(listing)
  const imageUrl = primaryListingImageUrl(listing.listing_images)
  const needsShipping = impliedFulfillment === "shipping"

  if (!resolved.ok) {
    return (
      <p className="text-sm text-destructive">
        This listing cannot be checked out ({resolved.error}).{" "}
        <Link href={backHref} className="underline">
          Back to listing
        </Link>
      </p>
    )
  }

  const paymentBlocked = !purchaseDetails.readyToPay

  const shippingSummaryRight = (() => {
    if (!needsShipping) {
      return <span className="text-neutral-500">Local pickup</span>
    }
    if (!purchaseDetails.readyToPay) {
      return <span className="text-neutral-400">Enter shipping address</span>
    }
    if (resolved.shipping === 0) {
      return <span className="text-neutral-700">Free</span>
    }
    return <span className="tabular-nums text-neutral-900">${resolved.shipping.toFixed(2)}</span>
  })()

  const payButtonClassName = cn(
    "h-[52px] w-full rounded-[6px] text-[16px] font-semibold shadow-none",
    "bg-[#0066CC] text-white hover:bg-[#0052a3] focus-visible:ring-[#0066CC]/40",
  )

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col lg:min-h-[calc(100dvh-4rem)]">
      <div className="flex w-full flex-1 flex-col lg:flex-row">
        {/* Left — forms */}
        <div className="order-2 flex-1 bg-white px-4 py-8 sm:px-8 lg:order-1 lg:max-w-[640px] lg:shrink-0 lg:px-10 lg:py-10 xl:px-14">
          <div className="mx-auto max-w-[520px] lg:mx-0">
            {canPick && canShip && (
              <div className="mb-10 space-y-3">
                <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Delivery method</h2>
                <RadioGroup
                  value={method}
                  onValueChange={(v) => setMethod(v as "pickup" | "shipping")}
                  className="grid gap-3 sm:grid-cols-2"
                >
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-[8px] border p-4 transition-colors",
                      method === "pickup"
                        ? "border-[#0066CC] bg-[#0066CC]/[0.04] shadow-[inset_0_0_0_1px_rgba(0,102,204,0.15)]"
                        : "border-neutral-200 bg-white hover:border-neutral-300",
                    )}
                  >
                    <RadioGroupItem value="pickup" id="fulfill-pickup" className="mt-0.5 border-neutral-400 text-[#0066CC]" />
                    <div className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <MapPin className="h-4 w-4 shrink-0 text-neutral-600" />
                        Local pickup
                      </span>
                      <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                        Meet the seller and inspect the {copy.inspectNoun} in person.
                      </p>
                    </div>
                  </label>
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-[8px] border p-4 transition-colors",
                      method === "shipping"
                        ? "border-[#0066CC] bg-[#0066CC]/[0.04] shadow-[inset_0_0_0_1px_rgba(0,102,204,0.15)]"
                        : "border-neutral-200 bg-white hover:border-neutral-300",
                    )}
                  >
                    <RadioGroupItem value="shipping" id="fulfill-ship" className="mt-0.5 border-neutral-400 text-[#0066CC]" />
                    <div className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Truck className="h-4 w-4 shrink-0 text-neutral-600" />
                        Ship to me
                      </span>
                      <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                        {resolved.shipping > 0
                          ? `Includes $${resolved.shipping.toFixed(2)} shipping (set by seller).`
                          : "Seller offers free shipping."}
                      </p>
                    </div>
                  </label>
                </RadioGroup>
              </div>
            )}

            <CheckoutPurchaseDetails
              buyerEmail={buyerEmail ?? null}
              initialAddresses={initialAddresses}
              needsShipping={needsShipping}
              onStateChange={handlePurchaseDetailsChange}
            />

            {needsShipping && (
              <div className="mt-10 space-y-3">
                <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Shipping</h2>
                <div className="rounded-[8px] border border-neutral-200 bg-neutral-100/80 px-4 py-3.5 text-[13px] leading-relaxed text-neutral-600">
                  {!purchaseDetails.readyToPay
                    ? "Enter your shipping address above to confirm delivery."
                    : resolved.shipping > 0
                      ? `Flat $${resolved.shipping.toFixed(2)} shipping from the seller — included in your total.`
                      : "Free shipping from this seller — included in your total."}
                </div>
              </div>
            )}

            <div className="mt-10 space-y-3">
              <div>
                <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Payment</h2>
                <p className="mt-1 text-[13px] text-neutral-500">All transactions are secure and encrypted.</p>
              </div>
              <div className="rounded-[8px] border border-neutral-200 bg-white p-4 sm:p-5">
                <PurchaseOptions
                  listingId={listing.id}
                  listingTitle={listing.title}
                  price={resolved.total}
                  fulfillment={fulfillmentForApi}
                  shippingAddressId={needsShipping ? purchaseDetails.shippingAddressId : null}
                  purchaseDetailsReady={!paymentBlocked}
                  needsShipping={needsShipping}
                  submitButtonLabel="Pay now"
                  submitButtonClassName={payButtonClassName}
                  hideStripeFooter
                />
                <p className="mt-3 text-center text-[12px] text-neutral-500">
                  Secure payment processed by{" "}
                  <span className="font-medium text-neutral-600">Stripe</span>
                </p>
              </div>
            </div>

            {needsShipping && (
              <div className="mt-8">
                <ProtectionTrustBlock />
              </div>
            )}

            <nav
              className="mt-12 flex flex-wrap gap-x-4 gap-y-2 border-t border-neutral-200 pt-8 text-[13px]"
              aria-label="Policies"
            >
              <Link href="/protection-policy" className="text-[#0066CC] underline-offset-2 hover:underline">
                Purchase protection
              </Link>
              <Link href="/privacy" className="text-[#0066CC] underline-offset-2 hover:underline">
                Privacy policy
              </Link>
              <Link href="/terms" className="text-[#0066CC] underline-offset-2 hover:underline">
                Terms of service
              </Link>
              <Link href="/cookies" className="text-[#0066CC] underline-offset-2 hover:underline">
                Cookies
              </Link>
            </nav>
          </div>
        </div>

        {/* Right — order summary */}
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
                className="flex items-center gap-1.5 text-[13px] font-medium text-[#0066CC] hover:underline"
              >
                <ShoppingBag className="h-4 w-4" aria-hidden />
                Cart
              </Link>
            </div>

            <div className="flex gap-4">
              <div className="relative h-[72px] w-[72px] shrink-0 overflow-hidden rounded-[8px] border border-neutral-200/80 bg-white shadow-sm">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt={capitalizeWords(listing.title)}
                    fill
                    className="object-cover"
                    sizes="72px"
                    priority
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
                {seller && (
                  <p className="mt-2 text-[12px] text-neutral-500">
                    Sold by{" "}
                    <Link href={sellerProfileHref(seller)} className="font-medium text-[#0066CC] hover:underline">
                      {sellerDisplayName(seller)}
                    </Link>
                  </p>
                )}
              </div>
              <p className="shrink-0 pt-0.5 text-[15px] font-semibold tabular-nums text-foreground">
                ${resolved.itemPrice.toFixed(2)}
              </p>
            </div>

            <div className="mt-6">
              <div className="flex gap-2">
                <div
                  className="flex h-11 min-w-0 flex-1 items-center rounded-[6px] border border-neutral-200 bg-white px-3 text-[13px] text-neutral-400"
                  role="status"
                >
                  Discount code or gift card
                </div>
                <div
                  className="flex h-11 shrink-0 items-center rounded-[6px] border border-neutral-200 bg-neutral-200/70 px-4 text-[13px] font-medium text-neutral-400"
                  aria-hidden
                >
                  Apply
                </div>
              </div>
              <p className="mt-2 text-[11px] text-neutral-400">Promo codes are not available for peer listings yet.</p>
            </div>

            <div className="mt-8 space-y-2.5 border-t border-neutral-200/90 pt-6 text-[14px]">
              <div className="flex justify-between gap-4">
                <span className="text-neutral-600">Subtotal</span>
                <span className="tabular-nums font-medium text-foreground">${resolved.itemPrice.toFixed(2)}</span>
              </div>
              <div className="flex justify-between gap-4">
                <span className="text-neutral-600">Shipping</span>
                <div className="text-right text-[14px]">{shippingSummaryRight}</div>
              </div>
              <div className="flex justify-between gap-4 border-t border-neutral-200/90 pt-4 text-[16px] font-semibold">
                <span className="text-foreground">Total</span>
                <p className="tabular-nums text-foreground">
                  <span className="text-[13px] font-normal text-neutral-500">USD </span>
                  ${resolved.total.toFixed(2)}
                </p>
              </div>
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
