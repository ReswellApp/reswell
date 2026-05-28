"use client"

import { useEffect, useRef } from "react"
import { reportSignUpConversion } from "@/lib/google-ads/sign-up-conversion"

/**
 * Fires the Google Ads sign-up conversion once when a new user lands on the welcome page.
 * The page stays visible so Tag Assistant and page-load conversions can record the visit.
 */
export function GoogleSignUpConversionBeacon(): null {
  const firedRef = useRef(false)

  useEffect(() => {
    if (firedRef.current) return
    firedRef.current = true
    void reportSignUpConversion({ gtagWaitMs: 15_000, callbackTimeoutMs: 4_000 })
  }, [])

  return null
}
