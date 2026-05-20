"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useRef } from "react"

/**
 * Fires Klaviyo **Checkout Started** once per checkout mount via API route.
 */
export function KlaviyoCheckoutStartedTracker(): null {
  const searchParams = useSearchParams()
  const sentRef = useRef(false)

  const fromCart = searchParams?.get("from_cart") === "1"
  const sellerId = searchParams?.get("seller_id")?.trim() ?? ""
  const listing = searchParams?.get("listing")?.trim() ?? ""

  useEffect(() => {
    if (sentRef.current) return
    if (!fromCart && !listing) return
    if (fromCart && !sellerId) return

    sentRef.current = true

    void fetch("/api/integrations/klaviyo/checkout-started", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({
        ...(fromCart ? { from_cart: true, seller_id: sellerId } : { listing }),
      }),
    }).catch(() => {})
  }, [fromCart, listing, sellerId])

  return null
}
