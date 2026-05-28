"use client"

import { useSearchParams } from "next/navigation"
import { useEffect, useRef } from "react"
import { Loader2 } from "lucide-react"
import { reportSignUpConversion } from "@/lib/google-ads/sign-up-conversion"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"

/**
 * Post-signup landing page: fires the Google Ads conversion, then sends the user into the app.
 * OAuth, email confirm, and email/password signup all route here for reliable gtag delivery.
 */
export default function SignUpSuccessPage() {
  const searchParams = useSearchParams()
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    startedRef.current = true

    const next = safeRedirectPath(searchParams.get("next"))

    void (async () => {
      await reportSignUpConversion({
        gtagWaitMs: 15_000,
        callbackTimeoutMs: 4_000,
      })
      window.location.replace(next)
    })()
  }, [searchParams])

  return (
    <div className="flex min-h-svh items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-label="Setting up your account" />
    </div>
  )
}
