import { redirect } from "next/navigation"
import { cookies } from "next/headers"
import { SignUpWelcomePanel } from "@/components/auth/sign-up-welcome-panel"
import { GoogleSignUpConversionBeacon } from "@/components/google-ads/google-sign-up-conversion-beacon"
import {
  GOOGLE_NEW_SIGNUP_COOKIE,
  shouldShowGoogleSignUpWelcome,
} from "@/lib/auth/google-sign-up-welcome"
import { oauthWelcomeFirstName } from "@/lib/auth/oauth-welcome-name"
import { isGoogleAuthUser } from "@/lib/auth/profile-completion"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import { buildGoogleSignUpSuccessPath } from "@/lib/google-ads/sign-up-success-path"
import { createClient } from "@/lib/supabase/server"

type PageProps = {
  searchParams: Promise<{ next?: string }>
}

/**
 * New Google sign-ups land here after OAuth. Returning Google users are sent straight to `next`.
 * Google Ads sign-up conversion: track visits to this URL (page load) or the gtag event fired here.
 */
export default async function GoogleSignUpSuccessPage({ searchParams }: PageProps) {
  const { next: nextRaw } = await searchParams
  const next = safeRedirectPath(nextRaw ?? null)

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect(
      `/auth/login?redirect=${encodeURIComponent(buildGoogleSignUpSuccessPath(next))}`,
    )
  }

  const cookieStore = await cookies()
  const markedFromCallback =
    cookieStore.get(GOOGLE_NEW_SIGNUP_COOKIE)?.value === "1"

  if (
    !isGoogleAuthUser(user) ||
    (!markedFromCallback && !shouldShowGoogleSignUpWelcome(user))
  ) {
    redirect(next)
  }

  const firstName = oauthWelcomeFirstName(user)

  return (
    <>
      <GoogleSignUpConversionBeacon />
      <SignUpWelcomePanel
        nextPath={next}
        firstName={firstName}
        subtitle="Your account is set up. Here is what you can do on Reswell."
        clearGoogleNewSignupCookieOnContinue
      />
    </>
  )
}
