import { passwordResetLandingPath } from "@/lib/auth/password-reset-landing-flag"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import { buildEmailSignUpSuccessPath } from "@/lib/google-ads/sign-up-success-path"
import { trackKlaviyoNewAccountCreated } from "@/lib/klaviyo/track-new-account-created"
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler-client"
import { type NextRequest, NextResponse } from "next/server"

// Handles email confirmation links from Supabase.
// Supabase's {{ .ConfirmationURL }} uses type=email (not signup) for confirm-signup emails.
// See https://supabase.com/docs/guides/auth/auth-email-templates
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type") as
    | "email"
    | "signup"
    | "recovery"
    | "invite"
    | null
  if (token_hash && type) {
    const isSignupConfirmation = type === "signup" || type === "email"
    let redirectPath =
      type === "recovery" ? passwordResetLandingPath() : safeRedirectPath(searchParams.get("next"))
    if (isSignupConfirmation) {
      redirectPath = buildEmailSignUpSuccessPath(redirectPath)
    }
    const redirectResponse = NextResponse.redirect(`${origin}${redirectPath}`)
    const supabase = createRouteHandlerSupabaseClient(
      request,
      redirectResponse,
    )
    const { data, error } = await supabase.auth.verifyOtp({
      token_hash,
      type,
    })

    if (!error) {
      const u = data.user ?? data.session?.user
      if (isSignupConfirmation && u) {
        await trackKlaviyoNewAccountCreated(u, {
          supabaseForProfile: supabase,
        })
      }
      redirectResponse.headers.set("Cache-Control", "private, no-store")
      return redirectResponse
    }
  }

  return NextResponse.redirect(
    `${origin}/auth/error?error=Could+not+confirm+your+email.+Please+try+again.`,
  )
}
