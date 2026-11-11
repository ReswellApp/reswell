"use client"

import { Suspense, useEffect } from "react"
import { useSearchParams } from "next/navigation"
import { AuthLandingShell } from "@/components/auth/auth-landing-shell"
import { SignUpFormPanel } from "@/components/auth/sign-up-form-panel"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import { MARKETING_OPT_IN_PARAM, parseMarketingOptInParam } from "@/lib/auth/marketing-email-consent"
import { GOOGLE_OAUTH_AUTO_START_PARAM } from "@/lib/auth/google-oauth-handoff-url"
import {
  SIGNUP_DATE_OF_BIRTH_PARAM,
  parseSignupDateOfBirthParam,
} from "@/lib/auth/signup-date-of-birth"

function SignUpLandingForm() {
  const searchParams = useSearchParams()
  const redirectTo = safeRedirectPath(searchParams.get("redirect"))
  const googleAutoStart = searchParams.get(GOOGLE_OAUTH_AUTO_START_PARAM) === "1"
  const marketingFromUrl = parseMarketingOptInParam(searchParams.get(MARKETING_OPT_IN_PARAM))
  const dateOfBirthFromUrl = parseSignupDateOfBirthParam(
    searchParams.get(SIGNUP_DATE_OF_BIRTH_PARAM),
  )

  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has(SIGNUP_DATE_OF_BIRTH_PARAM)) return
    url.searchParams.delete(SIGNUP_DATE_OF_BIRTH_PARAM)
    window.history.replaceState(window.history.state, "", `${url.pathname}${url.search}${url.hash}`)
  }, [])

  return (
    <AuthLandingShell size="wide">
      <SignUpFormPanel
        variant="landing"
        redirectTo={redirectTo}
        googleAutoStart={googleAutoStart}
        initialMarketingOptIn={marketingFromUrl ?? undefined}
        initialDateOfBirth={dateOfBirthFromUrl ?? undefined}
      />
    </AuthLandingShell>
  )
}

export function SignUpLandingPageClient() {
  return (
    <Suspense fallback={null}>
      <SignUpLandingForm />
    </Suspense>
  )
}
