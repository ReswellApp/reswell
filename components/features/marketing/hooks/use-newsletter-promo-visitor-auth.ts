"use client"

import { useEffect, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { isAnonymousSupabaseUser } from "@/lib/auth/is-anonymous-user"
import {
  hasSupabaseAuthCookiesClient,
} from "@/lib/auth/has-supabase-auth-cookies"
import { getAuthUserWithRetry } from "@/lib/auth/get-user-with-retry"
import { waitForClientSession } from "@/lib/auth/wait-for-client-session"
import { createClient } from "@/lib/supabase/client"

export function isSignedInReswellUser(user: User | null | undefined): boolean {
  return Boolean(user && !isAnonymousSupabaseUser(user))
}

/**
 * Resolves whether the visitor is a signed-in Reswell user before visitor-only promos run.
 * Waits for session hydration when auth cookies exist (Safari, Chrome, in-app search browsers).
 */
export function useNewsletterPromoVisitorAuth(serverUser: User | null | undefined): {
  authResolved: boolean
  isLoggedIn: boolean
} {
  const initiallyLoggedIn = isSignedInReswellUser(serverUser)
  const [authResolved, setAuthResolved] = useState(initiallyLoggedIn)
  const [isLoggedIn, setIsLoggedIn] = useState(initiallyLoggedIn)

  useEffect(() => {
    if (initiallyLoggedIn) {
      setIsLoggedIn(true)
      setAuthResolved(true)
      return
    }

    let cancelled = false
    const supabase = createClient()

    void (async () => {
      const likelyHasSession =
        hasSupabaseAuthCookiesClient()

      let user: User | null = null

      if (likelyHasSession) {
        const session = await waitForClientSession({
          supabase,
          maxAttempts: 32,
          msBetween: 75,
        })
        user = session?.user ?? null
      }

      if (!user) {
        const result = await getAuthUserWithRetry(supabase, { attempts: 3 })
        if (result.ok) {
          user = result.user
        }
      }

      if (cancelled) return
      setIsLoggedIn(isSignedInReswellUser(user))
      setAuthResolved(true)
    })()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(isSignedInReswellUser(session?.user ?? null))
      setAuthResolved(true)
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [initiallyLoggedIn, serverUser?.id])

  return { authResolved, isLoggedIn }
}
