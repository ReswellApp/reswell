import { buildAuthCompletingUrl } from "@/lib/auth/build-auth-completing-url"
import { exchangeAuthCodeWithRetry } from "@/lib/auth/exchange-auth-code-with-retry"
import { isRecoverableOAuthCodeExchangeError } from "@/lib/auth/is-recoverable-oauth-code-exchange-error"
import { passwordResetLandingPath } from "@/lib/auth/password-reset-landing-flag"
import { waitForUserAfterOAuthExchange } from "@/lib/auth/wait-for-user-after-oauth-exchange"
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler-client"
import { type NextRequest, NextResponse } from "next/server"

/**
 * Single-purpose OAuth-style callback URL for Supabase reset-password emails (`redirect_to`).
 * Use this exact path (no query string) so Supabase URL allowlists cannot reject wildcard
 * rules that treat `…/callback?next=…` differently from `…/callback`.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type")
  const landing = passwordResetLandingPath()

  if (code) {
    const redirectResponse = NextResponse.redirect(`${origin}${landing}`)
    const supabase = createRouteHandlerSupabaseClient(request, redirectResponse)
    const { data, error } = await exchangeAuthCodeWithRetry(supabase, code)
    if (!error && data.session) {
      redirectResponse.headers.set("Cache-Control", "private, no-store")
      return redirectResponse
    }

    const pollAttempts =
      error && isRecoverableOAuthCodeExchangeError(error) ? 32 : 24
    const existingUser = await waitForUserAfterOAuthExchange(supabase, {
      maxAttempts: pollAttempts,
      baseDelayMs: 100,
    })
    if (existingUser) {
      redirectResponse.headers.set("Cache-Control", "private, no-store")
      return redirectResponse
    }
  }

  if (token_hash && type === "recovery") {
    const redirectResponse = NextResponse.redirect(`${origin}${landing}`)
    const supabase = createRouteHandlerSupabaseClient(request, redirectResponse)
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: "recovery",
    })
    if (!error) {
      redirectResponse.headers.set("Cache-Control", "private, no-store")
      return redirectResponse
    }
  }

  return NextResponse.redirect(
    buildAuthCompletingUrl(origin, "/auth/forgot-password"),
  )
}
