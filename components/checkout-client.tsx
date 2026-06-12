"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { CheckoutOrderSummaryAside } from "@/components/checkout-order-summary-aside"
import { CheckoutPurchaseDetails, type PurchaseDetailsState } from "@/components/checkout-purchase-details"
import type { CheckoutCopy, CheckoutListing, CheckoutSeller } from "@/components/checkout-types"
import { PurchaseOptions } from "@/components/purchase-options"
import { ProtectionTrustBlock } from "@/components/protection-trust-block"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { listingShipFromDisplayLine } from "@/lib/listing-ship-from-display"
import { resolvePayableAmount } from "@/lib/purchase-amount"
import { listingDetailHref } from "@/lib/listing-href"
import { capitalizeWords } from "@/lib/listing-labels"
import type { ProfileAddressRow } from "@/lib/profile-address"
import { prefetchStripeCheckout } from "@/lib/stripe/prefetch-stripe-checkout"
import { Truck, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"
import { LISTING_RESELL_SHIPPING_UNAVAILABLE_MESSAGE } from "@/lib/services/listingReswellShippability"

export type { CheckoutCopy, CheckoutListing, CheckoutSeller } from "@/components/checkout-types"

const SURFBOARD_COPY = {
  itemLineLabel: "Board",
  inspectNoun: "board",
  priceContextNoun: "board",
} as const

interface CheckoutClientProps {
  listings: CheckoutListing[]
  copy?: CheckoutCopy
  buyerEmail?: string | null
  initialAddresses: ProfileAddressRow[]
  seller?: CheckoutSeller | null
  /** When paying an accepted offer bundle, bypasses cart verification at payment. */
  offerId?: string | null
}

export function CheckoutClient({
  listings,
  copy = SURFBOARD_COPY,
  buyerEmail,
  initialAddresses,
  seller,
  offerId = null,
}: CheckoutClientProps) {
  const isBundle = listings.length > 1

  const primaryListing = listings[0]
  if (!primaryListing) {
    return (
      <p className="text-sm text-destructive">
        Nothing to check out.{" "}
        <Link href="/cart" className="underline">
          Back to cart
        </Link>
      </p>
    )
  }

  const canPick = isBundle
    ? listings.every((l) => l.local_pickup !== false)
    : primaryListing.local_pickup !== false

  /** Bundles ship as one box only when every board offers shippable carrier delivery. */
  const listingCanShipAtCheckout = (l: CheckoutListing) =>
    l.shipping_quoteable !== undefined ? l.shipping_quoteable : !!l.shipping_available

  const canShip = isBundle
    ? listings.every(listingCanShipAtCheckout)
    : listingCanShipAtCheckout(primaryListing)

  const shippingConfiguredButBroken = isBundle
    ? listings.some((l) => l.shipping_configured_but_broken)
    : !!primaryListing.shipping_configured_but_broken

  const [method, setMethod] = useState<"pickup" | "shipping">(() => {
    if (canPick && !canShip) return "pickup"
    if (!canPick && canShip) return "shipping"
    return "pickup"
  })

  /** Multi-item payment intents always require an explicit fulfillment. */
  const impliedFulfillment: "pickup" | "shipping" =
    canPick && canShip ? method : !canPick && canShip ? "shipping" : "pickup"

  const fulfillmentForApi = isBundle
    ? impliedFulfillment
    : canPick && canShip
      ? method
      : undefined

  const needsShipping = impliedFulfillment === "shipping"

  const resolved = useMemo(() => {
    if (isBundle) {
      let itemSum = 0
      for (const l of listings) {
        const r = resolvePayableAmount(l, "pickup")
        if (!r.ok) return r
        itemSum += r.itemPrice
      }
      /** Bundle shipping is a single live one-box quote — shown once the quote API responds. */
      return { ok: true as const, itemPrice: itemSum, shipping: 0, total: itemSum }
    }
    return resolvePayableAmount(primaryListing, impliedFulfillment)
  }, [isBundle, listings, primaryListing, impliedFulfillment])

  const [purchaseDetails, setPurchaseDetails] = useState<PurchaseDetailsState>({
    readyToPay: false,
    shippingAddressId: null,
  })

  const listingIds = useMemo(() => listings.map((l) => l.id), [listings])
  const listingIdsKey = listingIds.join(",")

  const [shipQuote, setShipQuote] = useState<{
    shippingUsd: number
    totalUsd: number
    usedReswellQuote: boolean
  } | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)

  useEffect(() => {
    void prefetchStripeCheckout()
  }, [])

  useEffect(() => {
    if (!needsShipping) {
      setShipQuote(null)
      setQuoteError(null)
      setQuoteLoading(false)
      return
    }

    if (!purchaseDetails.shippingAddressId) {
      setShipQuote(null)
      setQuoteError(null)
      setQuoteLoading(false)
      return
    }

    let cancelled = false
    setQuoteLoading(true)
    setQuoteError(null)
    void (async () => {
      try {
        const res = await fetch("/api/checkout/shipping-quote", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            listing_ids: listingIdsKey.split(","),
            address_id: purchaseDetails.shippingAddressId,
          }),
        })
        const data = (await res.json()) as {
          error?: string
          data?: { shippingUsd: number; totalUsd: number; usedReswellQuote: boolean }
        }
        if (cancelled) return
        if (!res.ok || !data.data) {
          setShipQuote(null)
          setQuoteError(data.error?.trim() || "Could not calculate shipping for this address.")
          return
        }
        setShipQuote({
          shippingUsd: data.data.shippingUsd,
          totalUsd: data.data.totalUsd,
          usedReswellQuote: data.data.usedReswellQuote,
        })
      } catch {
        if (!cancelled) {
          setShipQuote(null)
          setQuoteError("Could not calculate shipping for this address.")
        }
      } finally {
        if (!cancelled) setQuoteLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [needsShipping, listingIdsKey, purchaseDetails.shippingAddressId])

  const handlePurchaseDetailsChange = useCallback((state: PurchaseDetailsState) => {
    setPurchaseDetails(state)
  }, [])

  const backHref = listingDetailHref(primaryListing)

  const shipFromLocalityLine = useMemo(
    () => listingShipFromDisplayLine(primaryListing.city, primaryListing.state),
    [primaryListing.city, primaryListing.state],
  )

  const inspectNounPhrase =
    listings.length > 1 ? `${listings.length} boards` : copy.inspectNoun

  const listingSummaryTitle =
    listings.length === 1
      ? capitalizeWords(primaryListing.title)
      : `${listings.length} surfboards`

  if (isBundle && !canPick && !canShip) {
    return (
      <p className="text-sm text-destructive">
        These boards don&apos;t share a delivery method — some are pickup-only and others are shipping-only. Check them
        out separately.{" "}
        <Link href="/cart" className="underline">
          Back to cart
        </Link>
      </p>
    )
  }

  if (!resolved.ok) {
    return (
      <p className="text-sm text-destructive">
        {shippingConfiguredButBroken && !canPick
          ? LISTING_RESELL_SHIPPING_UNAVAILABLE_MESSAGE
          : `This order cannot be checked out (${resolved.error}).`}{" "}
        <Link href={backHref} className="underline">
          Back to listing
        </Link>
      </p>
    )
  }

  const displayTotals =
    needsShipping && shipQuote
      ? {
          itemPrice: resolved.itemPrice,
          shipping: shipQuote.shippingUsd,
          total: shipQuote.totalUsd,
        }
      : {
          itemPrice: resolved.itemPrice,
          shipping: resolved.shipping,
          total: resolved.total,
        }

  const shipMethodSubtitle = (() => {
    if (quoteError) {
      return quoteError
    }
    if (isBundle && !shipQuote) {
      return "All boards ship together in one box — rate is calculated for your address."
    }
    if (shipQuote?.usedReswellQuote) {
      return displayTotals.shipping > 0
        ? `Includes about $${displayTotals.shipping.toFixed(2)} carrier shipping (Reswell rate).`
        : "Reswell carrier rate is included in your total (seller covers shipping)."
    }
    if (displayTotals.shipping > 0) {
      return `Includes $${displayTotals.shipping.toFixed(2)} shipping (set by seller).`
    }
    return "Seller offers free shipping."
  })()

  const shippingInfoCopy = (() => {
    if (!purchaseDetails.readyToPay) {
      return "Enter your shipping address above to confirm delivery."
    }
    if (quoteError) {
      return quoteError
    }
    if (quoteLoading) {
      return "Getting live carrier rates for your address…"
    }
    if (shipQuote?.usedReswellQuote) {
      return displayTotals.shipping > 0
        ? `Reswell recommended shipping (carrier rate) is about $${displayTotals.shipping.toFixed(2)} — included in your total.`
        : "Reswell carrier rate is included in your total."
    }
    if (displayTotals.shipping > 0) {
      return `Flat $${displayTotals.shipping.toFixed(2)} shipping from the seller — included in your total.`
    }
    return "Free shipping from this seller — included in your total."
  })()

  const shippingQuoteReady = !needsShipping || (!!shipQuote && !quoteLoading && !quoteError)
  const paymentBlocked = !purchaseDetails.readyToPay || !shippingQuoteReady

  const shippingSummaryRight = (() => {
    if (!needsShipping) {
      return <span className="text-neutral-500">Local pickup</span>
    }
    // Short text keeps the aside shipping row stable (no line-wrap on mobile = no height shift).
    if (!purchaseDetails.readyToPay) {
      return <span className="text-neutral-400">—</span>
    }
    if (quoteLoading) {
      return <span className="text-neutral-500">Calculating…</span>
    }
    if (quoteError) {
      return <span className="text-destructive">Unavailable</span>
    }
    if (displayTotals.shipping === 0) {
      return <span className="text-neutral-700">Free</span>
    }
    return <span className="tabular-nums text-neutral-900">${displayTotals.shipping.toFixed(2)}</span>
  })()

  const payButtonClassName = cn(
    "h-[52px] w-full rounded-[6px] text-[16px] font-semibold shadow-none",
    "bg-[#5574AD] text-white hover:bg-[#466091] focus-visible:ring-[#5574AD]/40",
  )

  return (
    <div className="flex min-h-[calc(100dvh-3.5rem)] flex-col lg:min-h-[calc(100dvh-4rem)]">
      <div className="flex w-full flex-1 flex-col lg:flex-row">
        {/* Left — forms */}
        <div className="order-2 flex-1 bg-white px-4 py-8 sm:px-8 lg:order-1 lg:max-w-[640px] lg:shrink-0 lg:px-10 lg:py-10 xl:px-14">
          <div className="mx-auto max-w-[520px] lg:mx-0">
            {isBundle ? (
              <div className="mb-10 rounded-[8px] border border-[#5574AD]/25 bg-[#5574AD]/[0.06] px-4 py-3.5 text-[13px] leading-relaxed text-neutral-700">
                You&apos;re buying <span className="font-semibold text-foreground">{listings.length} boards</span>{" "}
                from one seller in a single payment.{" "}
                {needsShipping ? (
                  <>
                    Everything ships together in <span className="font-medium text-foreground">one box</span> — shipping
                    is quoted once for the whole order.
                  </>
                ) : (
                  <>
                    This combined checkout uses <span className="font-medium text-foreground">local pickup</span> —
                    you&apos;ll get one pickup code that covers every board in this order.
                  </>
                )}
              </div>
            ) : null}

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
                        ? "border-[#5574AD] bg-[#5574AD]/[0.04] shadow-[inset_0_0_0_1px_rgba(85,116,173,0.15)]"
                        : "border-neutral-200 bg-white hover:border-neutral-300",
                    )}
                  >
                    <RadioGroupItem value="pickup" id="fulfill-pickup" className="mt-0.5 border-neutral-400 text-[#5574AD]" />
                    <div className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <MapPin className="h-4 w-4 shrink-0 text-neutral-600" />
                        Local pickup
                      </span>
                      <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                        Meet the seller and inspect {inspectNounPhrase} in person.
                      </p>
                    </div>
                  </label>
                  <label
                    className={cn(
                      "flex cursor-pointer items-start gap-3 rounded-[8px] border p-4 transition-colors",
                      method === "shipping"
                        ? "border-[#5574AD] bg-[#5574AD]/[0.04] shadow-[inset_0_0_0_1px_rgba(85,116,173,0.15)]"
                        : "border-neutral-200 bg-white hover:border-neutral-300",
                    )}
                  >
                    <RadioGroupItem value="shipping" id="fulfill-ship" className="mt-0.5 border-neutral-400 text-[#5574AD]" />
                    <div className="min-w-0">
                      <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                        <Truck className="h-4 w-4 shrink-0 text-neutral-600" />
                        Ship to me
                      </span>
                      <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                        {shipMethodSubtitle}
                      </p>
                    </div>
                  </label>
                </RadioGroup>
              </div>
            )}

            {needsShipping ? (
              <div className="mb-10 rounded-[8px] border border-neutral-200 bg-white px-4 py-3.5 sm:px-4">
                <p className="text-[12px] font-semibold uppercase tracking-wide text-neutral-500">Shipping from</p>
                {shipFromLocalityLine ? (
                  <>
                    <p className="mt-2 flex items-start gap-2 text-[14px] font-medium text-foreground">
                      <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-neutral-600" aria-hidden />
                      <span>{shipFromLocalityLine}</span>
                    </p>
                    <p className="mt-2 text-[12px] leading-relaxed text-neutral-500">
                      This is the area the seller chose when listing. We use it to estimate shipping for your purchase.
                    </p>
                  </>
                ) : (
                  <p className="mt-2 text-[13px] leading-relaxed text-neutral-600">
                    Rates use the map location from when this board was listed. If this looks off, the seller can edit
                    location on the listing.
                  </p>
                )}
              </div>
            ) : null}

            <CheckoutPurchaseDetails
              buyerEmail={buyerEmail ?? null}
              initialAddresses={initialAddresses}
              needsShipping={needsShipping}
              onStateChange={handlePurchaseDetailsChange}
            />

            {needsShipping && (
              <div className="mt-10 space-y-3">
                <h2 className="text-[15px] font-semibold tracking-tight text-foreground">Shipping</h2>
                {quoteError && purchaseDetails.readyToPay ? (
                  <p className="rounded-[8px] border border-destructive/30 bg-destructive/5 px-4 py-3.5 text-[13px] leading-relaxed text-destructive">
                    {quoteError}
                  </p>
                ) : null}
                <div className="min-h-[3.5rem] rounded-[8px] border border-neutral-200 bg-neutral-100/80 px-4 py-3.5 text-[13px] leading-relaxed text-neutral-600">
                  {shippingInfoCopy}
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
                  listingIds={listingIds}
                  listingTitle={listingSummaryTitle}
                  price={displayTotals.total}
                  fulfillment={fulfillmentForApi ?? null}
                  shippingAddressId={needsShipping ? purchaseDetails.shippingAddressId : null}
                  purchaseDetailsReady={!paymentBlocked}
                  needsShipping={needsShipping}
                  offerId={offerId}
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
              <Link href="/protection-policy" className="text-[#5574AD] underline-offset-2 hover:underline">
                Purchase protection
              </Link>
              <Link href="/privacy" className="text-[#5574AD] underline-offset-2 hover:underline">
                Privacy policy
              </Link>
              <Link href="/terms" className="text-[#5574AD] underline-offset-2 hover:underline">
                Terms of service
              </Link>
              <Link href="/cookies" className="text-[#5574AD] underline-offset-2 hover:underline">
                Cookies
              </Link>
            </nav>
          </div>
        </div>

        <CheckoutOrderSummaryAside
          listings={listings}
          seller={seller}
          needsShipping={needsShipping}
          displayTotals={displayTotals}
          shippingSummaryRight={shippingSummaryRight}
        />
      </div>
    </div>
  )
}
