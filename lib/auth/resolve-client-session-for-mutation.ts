import type { Session, SupabaseClient } from "@supabase/supabase-js"

import { getAuthUserWithRetry } from "@/lib/auth/get-user-with-retry"
import { hasSupabaseAuthCookiesClient } from "@/lib/auth/has-supabase-auth-cookies"
import { waitForClientSession } from "@/lib/auth/wait-for-client-session"
import { waitForServerSessionReady } from "@/lib/auth/wait-for-server-session-ready"

async function probeServerSessionReadyOnce(): Promise<boolean | null> {
  if (typeof window === "undefined") return false
  try {
    const res = await fetch("/api/auth/session-ready", {
      credentials: "include",
      cache: "no-store",
    })
    if (res.status === 204) return true
    if (res.status === 401) return false
    return null
  } catch {
    return null
  }
}

/**
 * Resolve a Supabase session for client-side mutations (photo upload, publish, etc.).
 * Tolerates cookie lag and brief token-refresh windows so gated actions do not
 * spuriously open the login modal for users who are already signed in.
 *
 * Guests (no client session + server reports 401) return immediately — do not poll
 * for seconds before opening sign-up.
 */
export async function resolveClientSessionForMutation(
  supabase: SupabaseClient,
): Promise<Session | null> {
  const { data: immediate } = await supabase.auth.getSession()
  if (immediate.session?.access_token && immediate.session.user) {
    return immediate.session
  }

  const clientPollOptions = { supabase, maxAttempts: 60, msBetween: 75 } as const

  if (hasSupabaseAuthCookiesClient()) {
    const session = await waitForClientSession(clientPollOptions)
    if (session?.access_token && session.user) return session
  } else {
    // SSR auth cookies are often httpOnly — invisible on document.cookie.
    // Probe once: only enter the long wait when the server already has a session
    // (or the probe was inconclusive). Guests get 401 and bail immediately.
    const serverReady = await probeServerSessionReadyOnce()
    if (serverReady === true) {
      await waitForServerSessionReady({ maxAttempts: 40, msBetween: 75 })
      const session = await waitForClientSession(clientPollOptions)
      if (session?.access_token && session.user) return session
    } else if (serverReady === null) {
      // Transient network — short retry window, not the full guest-hostile poll.
      await waitForServerSessionReady({ maxAttempts: 8, msBetween: 75 })
      const session = await waitForClientSession({
        supabase,
        maxAttempts: 8,
        msBetween: 75,
      })
      if (session?.access_token && session.user) return session
    }
  }

  const { data: initial } = await supabase.auth.getSession()
  if (initial.session?.access_token && initial.session.user) return initial.session

  const userResult = await getAuthUserWithRetry(supabase, { attempts: 2 })
  if (userResult.ok && userResult.user) {
    const { data } = await supabase.auth.getSession()
    if (data.session?.access_token && data.session.user) return data.session
  }

  return null
}
