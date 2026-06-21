import { buildAuthCompletingHtml } from "@/lib/auth/auth-completing-html"
import { copySupabaseAuthCookies } from "@/lib/auth/copy-supabase-auth-cookies"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import { waitForUserAfterOAuthExchange } from "@/lib/auth/wait-for-user-after-oauth-exchange"
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler-client"
import { type NextRequest, NextResponse } from "next/server"

const HTML_HEADERS = {
  "Content-Type": "text/html; charset=utf-8",
  "Cache-Control": "private, no-store",
} as const

function redirectWithAuthCookies(
  origin: string,
  destination: string,
  cookieSource: NextResponse,
): NextResponse {
  const response = NextResponse.redirect(`${origin}${destination}`)
  copySupabaseAuthCookies(cookieSource, response)
  response.headers.set("Cache-Control", "private, no-store")
  return response
}

/**
 * Minimal post-OAuth sync — no React layout. Server redirect when cookies are already
 * visible; otherwise a tiny HTML page polls `/api/auth/session-ready` (private Safari).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const destination = safeRedirectPath(searchParams.get("redirect"))

  const cookieProbe = new NextResponse(null, { status: 401 })
  cookieProbe.headers.set("Cache-Control", "private, no-store")
  const supabase = createRouteHandlerSupabaseClient(request, cookieProbe)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    return redirectWithAuthCookies(origin, destination, cookieProbe)
  }

  const recoveredUser = await waitForUserAfterOAuthExchange(supabase, {
    maxAttempts: 16,
    baseDelayMs: 75,
  })
  if (recoveredUser) {
    return redirectWithAuthCookies(origin, destination, cookieProbe)
  }

  return new NextResponse(buildAuthCompletingHtml(destination), {
    status: 200,
    headers: HTML_HEADERS,
  })
}
