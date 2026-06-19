"use client"

import { Suspense } from "react"
import { useSearchParams } from "next/navigation"
import { LoginFormPanel } from "@/components/auth/login-form-panel"
import { AuthTransitionShell } from "@/components/auth/auth-transition-shell"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"

import { GOOGLE_OAUTH_AUTO_START_PARAM } from "@/lib/auth/google-oauth-handoff-url"

function LoginForm() {
  const searchParams = useSearchParams()
  const redirectTo = safeRedirectPath(searchParams.get("redirect"))
  const googleAutoStart = searchParams.get(GOOGLE_OAUTH_AUTO_START_PARAM) === "1"
  return <LoginFormPanel redirectTo={redirectTo} variant="page" googleAutoStart={googleAutoStart} />
}

export default function Page() {
  return (
    <Suspense fallback={<AuthTransitionShell ariaLabel="Loading sign in" />}>
      <LoginForm />
    </Suspense>
  )
}
