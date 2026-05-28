"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef } from "react"
import {
  GOOGLE_ADS_SIGNUP_QUERY_PARAM,
  reportSignUpConversion,
} from "@/lib/google-ads/sign-up-conversion"

/**
 * After OAuth or email-confirm signup, `/auth/callback` and `/auth/confirm` redirect with
 * `gads_signup=1`. This component fires the Google Ads conversion once and strips the param.
 */
export function GoogleAdsSignUpConversionTracker(): null {
  const searchParams = useSearchParams()
  const pathname = usePathname()
  const router = useRouter()
  const handledRef = useRef(false)

  useEffect(() => {
    if (handledRef.current) return
    if (searchParams?.get(GOOGLE_ADS_SIGNUP_QUERY_PARAM) !== "1") return

    handledRef.current = true
    reportSignUpConversion()

    const nextParams = new URLSearchParams(searchParams.toString())
    nextParams.delete(GOOGLE_ADS_SIGNUP_QUERY_PARAM)
    const qs = nextParams.toString()
    const nextUrl = qs ? `${pathname}?${qs}` : pathname
    router.replace(nextUrl, { scroll: false })
  }, [pathname, router, searchParams])

  return null
}
