"use client"

import { useEffect, useRef } from "react"
import { GOOGLE_ADS_PURCHASE_QUERY_PARAM } from "@/lib/google-ads/purchase-success-path"

/**
 * Drops `gads_purchase=1` from the address bar without a Next.js navigation so the
 * conversion scripts stay mounted, but a refresh does not fire purchase pixels again.
 */
export function StripPurchaseConversionParam(): null {
  const strippedRef = useRef(false)

  useEffect(() => {
    if (strippedRef.current) return
    const url = new URL(window.location.href)
    if (url.searchParams.get(GOOGLE_ADS_PURCHASE_QUERY_PARAM) !== "1") return
    strippedRef.current = true
    url.searchParams.delete(GOOGLE_ADS_PURCHASE_QUERY_PARAM)
    window.history.replaceState(
      window.history.state,
      "",
      `${url.pathname}${url.search}${url.hash}`,
    )
  }, [])

  return null
}
