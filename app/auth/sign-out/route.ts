import { clearSupabaseAuthCookies } from "@/lib/auth/clear-supabase-auth-cookies"
import { safeRedirectPathWithQuery } from "@/lib/auth/safe-redirect"
import { IMPERSONATION_COOKIE } from "@/lib/impersonation"
import { createRouteHandlerSupabaseClient } from "@/lib/supabase/route-handler-client"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const next = safeRedirectPathWithQuery(searchParams.get("next") ?? "/")

  const redirectResponse = NextResponse.redirect(`${origin}${next}`)
  redirectResponse.headers.set("Cache-Control", "private, no-store")

  const supabase = createRouteHandlerSupabaseClient(request, redirectResponse)
  try {
    await supabase.auth.signOut({ scope: "global" })
  } catch {
    // Still purge cookies so the browser stops replaying a dead session.
  }

  clearSupabaseAuthCookies(request, redirectResponse)
  redirectResponse.cookies.set(IMPERSONATION_COOKIE, "", {
    path: "/",
    maxAge: 0,
  })

  return redirectResponse
}
