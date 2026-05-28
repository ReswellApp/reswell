import { cookies } from "next/headers"
import { SiteChromeClient } from "@/components/site-chrome-client"
import { hasSupabaseAuthCookies } from "@/lib/auth/has-supabase-auth-cookies"
import { getSiteChromeAuthPayload } from "@/lib/auth/get-site-chrome-auth"

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
  return <SiteChromeClient headerAuth={headerAuth}>{children}</SiteChromeClient>
}
