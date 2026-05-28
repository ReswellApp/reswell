import { safeRedirectPath } from "@/lib/auth/safe-redirect"

/** Google Ads page-load conversion URL — set this path in Google Ads → Goals → Conversions. */
export const GOOGLE_SIGN_UP_SUCCESS_PATH = "/auth/google-sign-up-success"

/** Email / password and email-confirm sign-ups. */
export const EMAIL_SIGN_UP_SUCCESS_PATH = "/auth/sign-up-success"

export function buildGoogleSignUpSuccessPath(nextPath: string): string {
  const next = safeRedirectPath(nextPath)
  return `${GOOGLE_SIGN_UP_SUCCESS_PATH}?next=${encodeURIComponent(next)}`
}

export function buildEmailSignUpSuccessPath(nextPath: string): string {
  const next = safeRedirectPath(nextPath)
  return `${EMAIL_SIGN_UP_SUCCESS_PATH}?next=${encodeURIComponent(next)}`
}

/** @deprecated Use {@link buildGoogleSignUpSuccessPath} or {@link buildEmailSignUpSuccessPath}. */
export function buildSignUpSuccessRedirectPath(nextPath: string): string {
  return buildEmailSignUpSuccessPath(nextPath)
}
