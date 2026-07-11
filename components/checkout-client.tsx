"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import {
  CheckoutOrderSummaryAside,
  type AppliedNewsletterPromo,
} from "@/components/checkout-order-summary-aside"
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
import {
  computeStaticPeerShippingQuoteUsd,
  listingHasShippingModeFields,
  peerCheckoutNeedsLiveShippingQuote,
} from "@/lib/checkout-peer-shipping-client"
import { effectiveBoardShippingMode } from "@/lib/services/peerListingShippingQuote"
import {
  peerCheckoutOffersShippingRateChoice,
  type PeerCheckoutShippingRateOption,
} from "@/lib/shipping/peer-checkout-usps-services"
import { Truck, MapPin } from "lucide-react"
import { cn } from "@/lib/utils"

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
  legalFullName?: string
  initialAddresses: ProfileAddressRow[]
  seller?: CheckoutSeller | null
  /** When paying an accepted offer bundle, bypasses cart verification at payment. */
  offerId?: string | null
}

export function CheckoutClient({
  listings,
  copy = SURFBOARD_COPY,
  buyerEmail,
  legalFullName = "",
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

  /** Bundles ship as one box only when every board offers shipping. */
  const canShip = isBundle
    ? listings.every((l) => !!l.shipping_available)
    : !!primaryListing.shipping_available

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
    selectedRate?: {
      rateId: string
      serviceCode: string
      serviceName: string
      displayName?: string
    } | null
    availableShippingRates?: PeerCheckoutShippingRateOption[] | null
  } | null>(null)
  const [selectedShippingRateId, setSelectedShippingRateId] = useState<string | null>(null)
  const [shipQuoteToken, setShipQuoteToken] = useState<string | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)
  const [quoteError, setQuoteError] = useState<string | null>(null)

  const offersShippingRateChoice = useMemo(() => {
    if (isBundle || !needsShipping) return false
    if (effectiveBoardShippingMode(primaryListing) !== "reswell") return false
    return peerCheckoutOffersShippingRateChoice(primaryListing.section)
  }, [isBundle, needsShipping, primaryListing])

  const isMagazineReswellCheckout = useMemo(() => {
    if (isBundle || !needsShipping) return false
    return primaryListing.section === "magazines" && effectiveBoardShippingMode(primaryListing) === "reswell"
  }, [isBundle, needsShipping, primaryListing])

  const needsLiveShippingQuote = useMemo(
    () => needsShipping && peerCheckoutNeedsLiveShippingQuote(listings.map(listingHasShippingModeFields)),
    [needsShipping, listings],
  )

  const [promoCodeInput, setPromoCodeInput] = useState("")
  const [appliedPromo, setAppliedPromo] = useState<AppliedNewsletterPromo | null>(null)
  const [promoError, setPromoError] = useState<string | null>(null)
  const [promoApplying, setPromoApplying] = useState(false)

  useEffect(() => {
    setAppliedPromo(null)
    setPromoError(null)
    setPromoCodeInput("")
    setShipQuoteToken(null)
    setSelectedShippingRateId(null)
  }, [listingIdsKey, impliedFulfillment])

  useEffect(() => {
    void prefetchStripeCheckout({ immediate: true })
  }, [])

  useEffect(() => {
    if (!needsShipping) {
      setShipQuote(null)
      setShipQuoteToken(null)
      setQuoteError(null)
      setQuoteLoading(false)
      return
    }

    if (!purchaseDetails.shippingAddressId) {
      setShipQuote(null)
      setShipQuoteToken(null)
      setQuoteError(null)
      setQuoteLoading(false)
      setSelectedShippingRateId(null)
      return
    }

    if (!needsLiveShippingQuote) {
      if (!resolved.ok) {
        setShipQuote(null)
        setShipQuoteToken(null)
        setQuoteError(resolved.error)
        setQuoteLoading(false)
        return
      }
      setShipQuote(computeStaticPeerShippingQuoteUsd(listings.map(listingHasShippingModeFields), resolved.itemPrice))
      setShipQuoteToken(null)
      setQuoteError(null)
      setQuoteLoading(false)
      return
    }

    let cancelled = false
    setQuoteLoading(true)
    setQuoteError(null)
    setShipQuoteToken(null)
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
            ...(selectedShippingRateId ? { selected_rate_id: selectedShippingRateId } : {}),
          }),
        })
        const data = (await res.json()) as {
          error?: string
          data?: {
            shippingUsd: number
            totalUsd: number
            usedReswellQuote: boolean
            quoteToken?: string | null
            selectedRate?: {
              rateId: string
              serviceCode: string
              serviceName: string
            } | null
            availableShippingRates?: PeerCheckoutShippingRateOption[] | null
          }
        }
        if (cancelled) return
        if (!res.ok || !data.data) {
          setShipQuote(null)
          setShipQuoteToken(null)
          setQuoteError(data.error?.trim() || "Could not calculate shipping for this address.")
          return
        }
        const selectedRate = data.data.selectedRate
          ? {
              ...data.data.selectedRate,
              displayName:
                data.data.availableShippingRates?.find(
                  (rate) => rate.rateId === data.data?.selectedRate?.rateId,
                )?.displayName ?? data.data.selectedRate.serviceName,
            }
          : null
        setShipQuote({
          shippingUsd: data.data.shippingUsd,
          totalUsd: data.data.totalUsd,
          usedReswellQuote: data.data.usedReswellQuote,
          selectedRate,
          availableShippingRates: data.data.availableShippingRates ?? null,
        })
        setShipQuoteToken(data.data.quoteToken?.trim() || null)
      } catch {
        if (!cancelled) {
          setShipQuote(null)
          setShipQuoteToken(null)
          setQuoteError("Could not calculate shipping for this address.")
        }
      } finally {
        if (!cancelled) setQuoteLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [
    needsShipping,
    needsLiveShippingQuote,
    listingIdsKey,
    listings,
    purchaseDetails.shippingAddressId,
    resolved,
    selectedShippingRateId,
  ])

  const handlePurchaseDetailsChange = useCallback((state: PurchaseDetailsState) => {
    setPurchaseDetails(state)
  }, [])

  const handleApplyPromo = useCallback(async () => {
    const code = promoCodeInput.trim()
    if (!code) return

    setPromoApplying(true)
    setPromoError(null)

    const itemSubtotal = resolved.ok ? resolved.itemPrice : 0
    const shippingUsd =
      needsShipping && shipQuote
        ? shipQuote.shippingUsd
        : resolved.ok
          ? resolved.shipping
          : 0

    try {
      const res = await fetch("/api/promo/validate", {
        method: "POST",
        cache: "no-store",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          code,
          item_subtotal_usd: itemSubtotal,
          shipping_usd: shippingUsd,
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
        setPromoError(data.error ?? "Could not apply promo code.")
        return
      }
      setAppliedPromo({
        code: data.data.code,
        discountUsd: data.data.discountUsd,
        discountPercent: data.data.discountPercent,
      })
      setPromoCodeInput(data.data.code)
    } catch {
      setAppliedPromo(null)
      setPromoError("Could not apply promo code.")
    } finally {
      setPromoApplying(false)
    }
  }, [promoCodeInput, resolved, needsShipping, shipQuote])

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
        This order cannot be checked out ({resolved.error}).{" "}
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
          discount: appliedPromo?.discountUsd,
        }
      : {
          itemPrice: resolved.itemPrice,
          shipping: resolved.shipping,
          total: resolved.total,
          discount: appliedPromo?.discountUsd,
        }

  const payableTotal = useMemo(() => {
    const baseTotal = displayTotals.total
    const discount = appliedPromo?.discountUsd ?? 0
    return Math.max(0, Math.round((baseTotal - discount) * 100) / 100)
  }, [displayTotals.total, appliedPromo?.discountUsd])

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
        {/* Left — forms (first on mobile so buyers reach payment without scrolling past summary) */}
        <div className="order-1 flex-1 bg-white px-4 py-8 sm:px-8 lg:max-w-[640px] lg:shrink-0 lg:px-10 lg:py-10 xl:px-14">
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
                        {isBundle && !shipQuote
                          ? "All boards ship together in one box — rate is calculated for your address."
                          : shipQuote?.usedReswellQuote
                            ? displayTotals.shipping > 0
                              ? `Includes about $${displayTotals.shipping.toFixed(2)} carrier shipping (Reswell rate).`
                              : "Seller offers free shipping."
                            : displayTotals.shipping > 0
                              ? `Includes $${displayTotals.shipping.toFixed(2)} shipping (set by seller).`
                              : "Seller offers free shipping."}
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
              legalFullName={legalFullName}
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
                {!purchaseDetails.readyToPay ? (
                  <div className="min-h-[3.5rem] rounded-[8px] border border-neutral-200 bg-neutral-100/80 px-4 py-3.5 text-[13px] leading-relaxed text-neutral-600">
                    Enter your shipping address above to confirm delivery.
                  </div>
                ) : quoteLoading ? (
                  <div className="min-h-[3.5rem] rounded-[8px] border border-neutral-200 bg-neutral-100/80 px-4 py-3.5 text-[13px] leading-relaxed text-neutral-600">
                    Getting live carrier rates for your address…
                  </div>
                ) : offersShippingRateChoice && shipQuote?.availableShippingRates?.length ? (
                  <div className="space-y-3 rounded-[8px] border border-neutral-200 bg-white px-4 py-4">
                    <p className="text-[13px] leading-relaxed text-neutral-600">
                      Choose USPS shipping for your fins. The amount you select is included in your total.
                    </p>
                    <RadioGroup
                      value={selectedShippingRateId ?? shipQuote.selectedRate?.rateId ?? ""}
                      onValueChange={(value) => setSelectedShippingRateId(value)}
                      className="space-y-2"
                    >
                      {shipQuote.availableShippingRates.map((rate) => (
                        <label
                          key={rate.rateId}
                          htmlFor={`checkout-shipping-${rate.rateId}`}
                          className="flex cursor-pointer items-start gap-3 rounded-[8px] border border-neutral-200 px-3.5 py-3 transition-colors has-[[data-state=checked]]:border-[#5574AD]/40 has-[[data-state=checked]]:bg-[#5574AD]/[0.04]"
                        >
                          <RadioGroupItem
                            id={`checkout-shipping-${rate.rateId}`}
                            value={rate.rateId}
                            className="mt-0.5"
                          />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[14px] font-medium text-foreground">{rate.displayName}</span>
                            <span className="mt-0.5 block text-[12px] text-neutral-500">
                              {rate.deliveryDays != null
                                ? `About ${rate.deliveryDays} business day${rate.deliveryDays === 1 ? "" : "s"}`
                                : "Estimated transit time from USPS"}
                            </span>
                          </span>
                          <span className="shrink-0 text-[14px] font-semibold tabular-nums text-foreground">
                            ${rate.totalAmount.toFixed(2)}
                          </span>
                        </label>
                      ))}
                    </RadioGroup>
                  </div>
                ) : (
                  <div className="min-h-[3.5rem] rounded-[8px] border border-neutral-200 bg-neutral-100/80 px-4 py-3.5 text-[13px] leading-relaxed text-neutral-600">
                    {shipQuote?.usedReswellQuote
                      ? displayTotals.shipping > 0
                        ? isMagazineReswellCheckout
                          ? `USPS Media Mail is $${displayTotals.shipping.toFixed(2)} — included in your total.`
                          : `Reswell recommended shipping (carrier rate) is about $${displayTotals.shipping.toFixed(2)} — included in your total.`
                        : "Free shipping from this seller — included in your total."
                      : displayTotals.shipping > 0
                        ? `Flat $${displayTotals.shipping.toFixed(2)} shipping from the seller — included in your total.`
                        : "Free shipping from this seller — included in your total."}
                  </div>
                )}
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
                  price={payableTotal}
                  fulfillment={fulfillmentForApi ?? null}
                  shippingAddressId={needsShipping ? purchaseDetails.shippingAddressId : null}
                  purchaseDetailsReady={!paymentBlocked}
                  needsShipping={needsShipping}
                  offerId={offerId}
                  promoCode={appliedPromo?.code ?? null}
                  shippingQuoteToken={shipQuoteToken}
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
          displayTotals={{
            ...displayTotals,
            total: payableTotal,
          }}
          shippingSummaryRight={shippingSummaryRight}
          promoCodeInput={promoCodeInput}
          onPromoCodeInputChange={setPromoCodeInput}
          onApplyPromo={() => void handleApplyPromo()}
          appliedPromo={appliedPromo}
          promoError={promoError}
          promoApplying={promoApplying}
          promoDisabled={Boolean(offerId)}
        />
      </div>
    </div>
  )
}
