"use client"

import { useEffect, useRef } from "react"
import { reportPurchaseConversion } from "@/lib/google-ads/purchase-conversion"

interface GooglePurchaseConversionBeaconProps {
  orderId: string
  value: number
  currency?: string
}

/**
 * Fires the Google Ads purchase conversion once when a buyer lands on order confirmation.
 */
export function GooglePurchaseConversionBeacon({
  orderId,
  value,
  currency = "USD",
}: GooglePurchaseConversionBeaconProps): null {
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true
    void reportPurchaseConversion({
      orderId,
      value,
      currency,
      gtagWaitMs: 15_000,
      callbackTimeoutMs: 4_000,
    })
  }, [currency, orderId, value])

  return null
}
