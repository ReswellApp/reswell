import type { Session, SupabaseClient } from "@supabase/supabase-js"

import { getAuthUserWithRetry } from "@/lib/auth/get-user-with-retry"
import { hasSupabaseAuthCookiesClient } from "@/lib/auth/has-supabase-auth-cookies"
import { waitForClientSession } from "@/lib/auth/wait-for-client-session"

/**
 * Resolve a Supabase session for client-side mutations (photo upload, publish, etc.).
 * Tolerates cookie lag and brief token-refresh windows so gated actions do not
 * spuriously open the login modal for users who are already signed in.
 */
export async function resolveClientSessionForMutation(
  supabase: SupabaseClient,
): Promise<Session | null> {
  if (hasSupabaseAuthCookiesClient()) {
    const session = await waitForClientSession({
      supabase,
      maxAttempts: 60,
      msBetween: 75,
    })
    if (session?.access_token && session.user) return session
  }

  const { data: initial } = await supabase.auth.getSession()
  if (initial.session?.access_token && initial.session.user) return initial.session

  const userResult = await getAuthUserWithRetry(supabase, { attempts: 4 })
  if (userResult.ok && userResult.user) {
    const { data } = await supabase.auth.getSession()
    if (data.session?.access_token && data.session.user) return data.session
  }

  return null
}
