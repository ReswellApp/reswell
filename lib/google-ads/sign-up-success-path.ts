import { safeRedirectPath } from "@/lib/auth/safe-redirect"

/** Redirect new accounts here so gtag can fire before entering the app. */
export function buildSignUpSuccessRedirectPath(nextPath: string): string {
  const next = safeRedirectPath(nextPath)
  return `/auth/sign-up-success?next=${encodeURIComponent(next)}`
}
