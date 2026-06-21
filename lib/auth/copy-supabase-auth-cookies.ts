import type { NextResponse } from "next/server"

/** Copy Supabase SSR auth cookies from one response onto another (OAuth redirects). */
export function copySupabaseAuthCookies(
  from: NextResponse,
  to: NextResponse,
): void {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set({
      name: cookie.name,
      value: cookie.value,
      path: cookie.path,
      domain: cookie.domain,
      expires: cookie.expires,
      maxAge: cookie.maxAge,
      httpOnly: cookie.httpOnly,
      secure: cookie.secure,
      sameSite: cookie.sameSite,
      priority: cookie.priority,
      partitioned: cookie.partitioned,
    })
  })
}
