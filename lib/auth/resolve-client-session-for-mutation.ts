import type { Session, SupabaseClient } from "@supabase/supabase-js"

import { getAuthUserWithRetry } from "@/lib/auth/get-user-with-retry"
import { hasSupabaseAuthCookiesClient } from "@/lib/auth/has-supabase-auth-cookies"
import { waitForClientSession } from "@/lib/auth/wait-for-client-session"
import { waitForServerSessionReady } from "@/lib/auth/wait-for-server-session-ready"

/**
 * Resolve a Supabase session for client-side mutations (photo upload, publish, etc.).
 * Tolerates cookie lag and brief token-refresh windows so gated actions do not
 * spuriously open the login modal for users who are already signed in.
 */
export async function resolveClientSessionForMutation(
  supabase: SupabaseClient,
): Promise<Session | null> {
  const clientPollOptions = { supabase, maxAttempts: 60, msBetween: 75 } as const

  if (hasSupabaseAuthCookiesClient()) {
    const session = await waitForClientSession(clientPollOptions)
    if (session?.access_token && session.user) return session
  } else {
    // SSR auth cookies are often httpOnly — invisible on document.cookie but valid server-side.
    await waitForServerSessionReady({ maxAttempts: 40, msBetween: 75 })
    const session = await waitForClientSession(clientPollOptions)
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
