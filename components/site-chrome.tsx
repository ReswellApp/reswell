import { cookies } from "next/headers"
import { SiteChromeClient } from "@/components/site-chrome-client"
import { hasSupabaseAuthCookies } from "@/lib/auth/has-supabase-auth-cookies"
import { getSiteChromeAuthPayload } from "@/lib/auth/get-site-chrome-auth"
import { IMPERSONATION_COOKIE, parseImpersonationCookie } from "@/lib/impersonation"

/**
 * **Server-first site chrome**: one validated `getUser()` + parallel header bootstrap per request,
 * then hydrates the client shell (see `SiteChromeClient`).
 *
 * Anonymous visitors without Supabase session cookies skip the server auth round-trip;
 * the header hydrates client-side when they sign in.
 */
export async function SiteChrome({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const headerAuth = hasSupabaseAuthCookies(cookieStore.getAll())
    ? await getSiteChromeAuthPayload()
    : { user: null, bootstrap: null }
  const impersonationRaw = cookieStore.get(IMPERSONATION_COOKIE)?.value
  const initialImpersonation = impersonationRaw
    ? parseImpersonationCookie(impersonationRaw)
    : null
  return (
    <SiteChromeClient
      headerAuth={headerAuth}
      initialImpersonation={initialImpersonation}
    >
      {children}
    </SiteChromeClient>
  )
}
