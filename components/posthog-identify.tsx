"use client"

import { useEffect } from "react"

import { ensurePostHogClient } from "@/lib/client/init-posthog-client"
import { createClient } from "@/lib/supabase/client"

/**
 * Identifies the signed-in user on load and auth changes so returning sessions
 * are not left on an anonymous distinct ID. Resets only on an explicit sign-out.
 *
 * Waits for the deferred PostHog client so identify does not pull posthog-js
 * onto the first-paint path.
 */
export function PostHogIdentify(): null {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return

    const supabase = createClient()
    let cancelled = false
    let unsubscribe: (() => void) | undefined

    void ensurePostHogClient().then((posthog) => {
      if (cancelled || !posthog) return

      const identifyUser = (userId: string, email?: string | null) => {
        posthog.identify(userId, email ? { email } : undefined)
      }

      void supabase.auth.getUser().then(({ data: { user } }) => {
        if (cancelled) return
        if (user) identifyUser(user.id, user.email)
      })

      const {
        data: { subscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (event === "SIGNED_OUT") {
          posthog.reset()
          return
        }
        if (session?.user) {
          identifyUser(session.user.id, session.user.email)
        }
      })

      unsubscribe = () => subscription.unsubscribe()
      if (cancelled) unsubscribe()
    })

    return () => {
      cancelled = true
      unsubscribe?.()
    }
  }, [])

  return null
}
