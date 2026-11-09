import { buildAuthCompletingPath } from "@/lib/auth/build-auth-completing-url"
import { copySupabaseAuthCookies } from "@/lib/auth/copy-supabase-auth-cookies"
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
 *
 * Successful exchanges redirect through `/auth/completing` (same as OAuth) so private /
 * incognito browsers sync httpOnly session cookies before `/auth/update-password` mounts.
 * Skipping that step left the update-password client gate on a spinner forever when
 * `getSession()` / `getUser()` could not see cookies yet.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const token_hash = searchParams.get("token_hash")
  const type = searchParams.get("type")
  const landing = passwordResetLandingPath()

  if (code) {
    const cookieJar = NextResponse.redirect(`${origin}${landing}`)
    const supabase = createRouteHandlerSupabaseClient(request, cookieJar)
    const { data, error } = await exchangeAuthCodeWithRetry(supabase, code)
    if (!error && data.session) {
      return redirectRecoveryThroughCompleting(origin, landing, cookieJar)
    }

    const pollAttempts =
      error && isRecoverableOAuthCodeExchangeError(error) ? 32 : 24
    const existingUser = await waitForUserAfterOAuthExchange(supabase, {
      maxAttempts: pollAttempts,
      baseDelayMs: 100,
    })
    if (existingUser) {
      return redirectRecoveryThroughCompleting(origin, landing, cookieJar)
    }
  }

  if (token_hash && type === "recovery") {
    const cookieJar = NextResponse.redirect(`${origin}${landing}`)
    const supabase = createRouteHandlerSupabaseClient(request, cookieJar)
    const { error } = await supabase.auth.verifyOtp({
      token_hash,
      type: "recovery",
    })
    if (!error) {
      return redirectRecoveryThroughCompleting(origin, landing, cookieJar)
    }
  }

  // Invalid / expired link — land on the update form so the client can show
  // "Link expired" immediately instead of the OAuth "Completing sign in" spinner.
  const expired = NextResponse.redirect(`${origin}${landing}`)
  expired.headers.set("Cache-Control", "private, no-store")
  return expired
}

function redirectRecoveryThroughCompleting(
  origin: string,
  landing: string,
  cookieSource: NextResponse,
): NextResponse {
  const response = NextResponse.redirect(
    `${origin}${buildAuthCompletingPath(landing)}`,
  )
  copySupabaseAuthCookies(cookieSource, response)
  response.headers.set("Cache-Control", "private, no-store")
  return response
}
