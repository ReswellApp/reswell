import { passwordResetLandingPath } from "@/lib/auth/password-reset-landing-flag"
import {
  shouldTrackKlaviyoNewAccountForOAuthSession,
  trackKlaviyoNewAccountCreated,
} from "@/lib/klaviyo/track-new-account-created"
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

  if (code) {
    const redirectResponse = NextResponse.redirect(`${origin}${passwordResetLandingPath()}`)
    const supabase = createRouteHandlerSupabaseClient(request, redirectResponse)
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error && data.session) {
      const u = data.session.user
      if (u && shouldTrackKlaviyoNewAccountForOAuthSession(u)) {
        await trackKlaviyoNewAccountCreated(u, { supabaseForProfile: supabase })
      }
      redirectResponse.headers.set("Cache-Control", "private, no-store")
      return redirectResponse
    }
  }

  if (token_hash && type === "recovery") {
    const redirectResponse = NextResponse.redirect(`${origin}${passwordResetLandingPath()}`)
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
    `${origin}/auth/error?error=This+password+reset+link+is+invalid+or+has+expired.`,
  )
}
