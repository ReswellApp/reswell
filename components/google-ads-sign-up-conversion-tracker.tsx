"use client"

import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { useEffect, useRef } from "react"
import {
  GOOGLE_ADS_SIGNUP_QUERY_PARAM,
  hasReportedSignUpConversion,
  reportSignUpConversion,
} from "@/lib/google-ads/sign-up-conversion"

/**
 * Backup for OAuth / email-confirm signup: if the inline gtag snippet did not fire yet,
 * retry here, then strip {@link GOOGLE_ADS_SIGNUP_QUERY_PARAM} from the URL.
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

    void (async () => {
      if (!hasReportedSignUpConversion()) {
        await reportSignUpConversion()
      }

      const nextParams = new URLSearchParams(searchParams.toString())
      nextParams.delete(GOOGLE_ADS_SIGNUP_QUERY_PARAM)
      const qs = nextParams.toString()
      const nextUrl = qs ? `${pathname}?${qs}` : pathname
      router.replace(nextUrl, { scroll: false })
    })()
  }, [pathname, router, searchParams])

  return null
}
