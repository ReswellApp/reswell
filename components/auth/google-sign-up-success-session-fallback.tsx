"use client"

import { AuthServerSessionGate } from "@/components/auth/auth-server-session-gate"
import { buildGoogleSignUpSuccessPath } from "@/lib/google-ads/sign-up-success-path"

type GoogleSignUpSuccessSessionFallbackProps = {
  next: string
}

/** Waits for SSR cookies after OAuth before sending new users to login. */
export function GoogleSignUpSuccessSessionFallback({
  next,
}: GoogleSignUpSuccessSessionFallbackProps) {
  return (
    <AuthServerSessionGate
      onTimeout={() => {
        window.location.replace(
          `/auth/login?redirect=${encodeURIComponent(buildGoogleSignUpSuccessPath(next))}`,
        )
      }}
    />
  )
}
