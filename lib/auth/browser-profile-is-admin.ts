import type { SupabaseClient } from "@supabase/supabase-js"
import { getAuthUserWithRetry } from "@/lib/auth/get-user-with-retry"
import { hasSupabaseAuthCookiesClient } from "@/lib/auth/has-supabase-auth-cookies"

/**
 * Admin chrome on cached public pages (the /boards CMS plus).
 *
 * The header stays on Sign up / Log in until `document.cookie` has a Supabase
 * auth cookie. A server action posted to `/boards` does not use that signal:
 * it reads request cookies the header cannot see, and that POST used to be
 * eligible for the public CDN cache on the page URL. Either path can paint the
 * plus while the header still says logged out.
 *
 * `false` — same logged-out conclusion as the header.
 * `true` — this browser session's profile is an admin.
 * `null` — cookies exist but the browser auth call failed; caller may ask the server.
 */
export async function browserProfileIsAdmin(
  supabase: SupabaseClient,
  options?: { hasAuthCookies?: boolean },
): Promise<boolean | null> {
  const hasAuthCookies = options?.hasAuthCookies ?? hasSupabaseAuthCookiesClient()
  if (!hasAuthCookies) return false

  const userResult = await getAuthUserWithRetry(supabase)
  if (!userResult.ok) return null
  if (!userResult.user) return false

  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", userResult.user.id)
    .maybeSingle()
  if (error) return null

  const row = data as { is_admin?: boolean | null } | null
  return row?.is_admin === true
}
