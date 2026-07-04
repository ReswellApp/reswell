"use client"

import { useSearchParams } from "next/navigation"
import { AuthLandingShell } from "@/components/auth/auth-landing-shell"
import { LoginFormPanel } from "@/components/auth/login-form-panel"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import { GOOGLE_OAUTH_AUTO_START_PARAM } from "@/lib/auth/google-oauth-handoff-url"

export function LoginLandingPageClient() {
  const searchParams = useSearchParams()
  const redirectTo = safeRedirectPath(searchParams.get("redirect"))
  const googleAutoStart = searchParams.get(GOOGLE_OAUTH_AUTO_START_PARAM) === "1"
  const signedOut = searchParams.get("signed_out") === "1"

  return (
    <AuthLandingShell>
      <LoginFormPanel
        redirectTo={redirectTo}
        variant="landing"
        googleAutoStart={googleAutoStart}
        signedOut={signedOut}
      />
    </AuthLandingShell>
  )
}
