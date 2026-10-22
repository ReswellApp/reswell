import { clearSupabaseAuthCookies } from "@/lib/auth/clear-supabase-auth-cookies"
import { HEADER_CHROME_SIGNED_OUT_STORAGE_KEY } from "@/lib/auth/header-chrome-snapshot"
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
    // The SSR client writes cookie clears from the SIGNED_OUT callback. Let that
    // finish, then overwrite them — a Max-Age=0 write without Expires is parsed
    // back into an empty session cookie and the next page still looks signed in.
    await new Promise((resolve) => setTimeout(resolve, 0))
  } catch {
    // Still purge cookies so the browser stops replaying a dead session.
  }

  clearSupabaseAuthCookies(request, redirectResponse)
  // The next document reads this and drops the remembered header account.
  // httpOnly must stay false — the boot script clears it from document.cookie.
  redirectResponse.cookies.set(HEADER_CHROME_SIGNED_OUT_STORAGE_KEY, "1", {
    path: "/",
    maxAge: 120,
    sameSite: "lax",
    httpOnly: false,
  })
  redirectResponse.cookies.set(IMPERSONATION_COOKIE, "", {
    path: "/",
    maxAge: 0,
  })

  return redirectResponse
}
