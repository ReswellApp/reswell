"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import { CheckoutPurchaseDetails } from "@/components/checkout-purchase-details"
import { getOfferBuyerContact } from "@/lib/actions/offerBuyerContact"
import type { ProfileAddressRow } from "@/lib/profile-address"
import type { OfferShippingCostMode } from "@/lib/offer-listing-shipping"

export type OfferDeliveryReadyState = {
  ready: boolean
  addressId: string | null
  quoteToken: string | null
  shippingUsd: number | null
  quoteError: string | null
}

export function OfferDeliveryStep({
  listingId,
  fulfillment,
  offerAmount,
  shippingCostMode,
  shippingFlatRate,
  onStateChange,
}: {
  listingId: string
  fulfillment: "pickup" | "shipping"
  offerAmount: number
  shippingCostMode: OfferShippingCostMode | null
  shippingFlatRate: number
  onStateChange: (state: OfferDeliveryReadyState) => void
}) {
  const needsShipping = fulfillment === "shipping"
  const needsLiveQuote = needsShipping && shippingCostMode === "reswell"
  const [loading, setLoading] = useState(true)
  const [addresses, setAddresses] = useState<ProfileAddressRow[]>([])
  const [buyerEmail, setBuyerEmail] = useState<string | null>(null)
  const [buyerPhone, setBuyerPhone] = useState<string | null>(null)
  const [legalFullName, setLegalFullName] = useState("")
  const [addressId, setAddressId] = useState<string | null>(null)
  const [detailsReady, setDetailsReady] = useState(false)
  const [quoteToken, setQuoteToken] = useState<string | null>(null)
  const [shippingUsd, setShippingUsd] = useState<number | null>(() => {
    if (!needsShipping) return 0
    if (shippingCostMode === "free") return 0
    if (shippingCostMode === "flat") return Math.max(0, shippingFlatRate)
    return null
  })
  const [quoteError, setQuoteError] = useState<string | null>(null)
  const [quoteLoading, setQuoteLoading] = useState(false)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      const contact = await getOfferBuyerContact()
      if (cancelled) return
      if (contact.ok) {
        setAddresses(contact.buyer.addresses)
        setBuyerEmail(contact.buyer.buyerEmail)
        setBuyerPhone(contact.buyer.buyerPhone)
        setLegalFullName(contact.buyer.legalFullName)
      }
      setLoading(false)
    })()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (!needsShipping) {
      setShippingUsd(0)
      setQuoteToken(null)
      setQuoteError(null)
      return
    }
    if (!needsLiveQuote) {
      const usd = shippingCostMode === "free" ? 0 : Math.max(0, shippingFlatRate)
      setShippingUsd(usd)
      setQuoteToken(null)
      setQuoteError(null)
      return
    }
    if (!addressId) {
      setShippingUsd(null)
      setQuoteToken(null)
      setQuoteError(null)
      return
    }

    let cancelled = false
    setQuoteLoading(true)
    setQuoteError(null)
    setQuoteToken(null)
    void (async () => {
      try {
        const res = await fetch("/api/checkout/shipping-quote", {
          method: "POST",
          cache: "no-store",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            listing_ids: [listingId],
            address_id: addressId,
          }),
        })
        const data = (await res.json()) as {
          error?: string
          data?: {
            shippingUsd?: number
            quoteToken?: string | null
          }
        }
        if (cancelled) return
        if (!res.ok || typeof data.data?.shippingUsd !== "number") {
          setShippingUsd(null)
          setQuoteToken(null)
          setQuoteError(data.error?.trim() || "Could not calculate shipping for this address.")
          return
        }
        setShippingUsd(Math.round(data.data.shippingUsd * 100) / 100)
        setQuoteToken(data.data.quoteToken?.trim() || null)
        setQuoteError(null)
      } catch {
        if (!cancelled) {
          setShippingUsd(null)
          setQuoteToken(null)
          setQuoteError("Could not calculate shipping for this address.")
        }
      } finally {
        if (!cancelled) setQuoteLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [addressId, listingId, needsLiveQuote, needsShipping, shippingCostMode, shippingFlatRate])

  useEffect(() => {
    const quoteReady = !needsShipping || (!needsLiveQuote && shippingUsd != null) || Boolean(quoteToken)
    onStateChange({
      ready: detailsReady && quoteReady && !quoteError,
      addressId: needsShipping ? addressId : null,
      quoteToken,
      shippingUsd,
      quoteError,
    })
  }, [
    addressId,
    detailsReady,
    needsLiveQuote,
    needsShipping,
    onStateChange,
    quoteError,
    quoteToken,
    shippingUsd,
  ])

  if (loading) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Loading your details…
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <CheckoutPurchaseDetails
        buyerEmail={buyerEmail}
        buyerPhone={buyerPhone}
        initialAddresses={addresses}
        needsShipping={needsShipping}
        legalFullName={legalFullName}
        onStateChange={(state) => {
          setDetailsReady(state.readyToPay)
          setAddressId(state.shippingAddressId)
        }}
      />
      {needsShipping ? (
        <div className="rounded-lg border border-border/60 bg-muted/20 px-3 py-2.5 text-sm">
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Shipping</span>
            <span className="font-semibold tabular-nums">
              {quoteLoading
                ? "Calculating…"
                : shippingUsd != null
                  ? shippingUsd === 0
                    ? "Free"
                    : `$${shippingUsd.toFixed(2)}`
                  : "—"}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>Reserved total</span>
            <span className="tabular-nums">
              {shippingUsd != null
                ? `$${(Math.round((offerAmount + shippingUsd) * 100) / 100).toFixed(2)}`
                : "—"}
            </span>
          </div>
          {quoteError ? <p className="mt-2 text-xs text-destructive">{quoteError}</p> : null}
        </div>
      ) : (
        <p className="text-xs leading-relaxed text-muted-foreground">
          You’ll arrange pickup with the seller after they accept — no shipping charged.
        </p>
      )}
    </div>
  )
}
