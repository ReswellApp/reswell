"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { AuthLandingShell } from "@/components/auth/auth-landing-shell"
import { SignUpFormPanel } from "@/components/auth/sign-up-form-panel"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import { GOOGLE_OAUTH_AUTO_START_PARAM } from "@/lib/auth/google-oauth-handoff-url"

function SignUpLandingForm() {
  const searchParams = useSearchParams()
  const redirectTo = safeRedirectPath(searchParams.get("redirect"))
  const googleAutoStart = searchParams.get(GOOGLE_OAUTH_AUTO_START_PARAM) === "1"

  return (
    <AuthLandingShell mode="sign-up" redirectTo={redirectTo}>
      <SignUpFormPanel
        variant="landing"
        redirectTo={redirectTo}
        googleAutoStart={googleAutoStart}
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
