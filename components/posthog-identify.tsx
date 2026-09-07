"use client"

import { useEffect } from "react"
import posthog from "posthog-js"
import { createClient } from "@/lib/supabase/client"

/**
 * Identifies the signed-in user on load and auth changes so returning sessions
 * are not left on an anonymous distinct ID. Resets only on an explicit sign-out.
 */
export function PostHogIdentify(): null {
  useEffect(() => {
    if (!process.env.NEXT_PUBLIC_POSTHOG_PROJECT_TOKEN) return

    const supabase = createClient()

    const identifyUser = (userId: string, email?: string | null) => {
      posthog.identify(userId, email ? { email } : undefined)
    }

    void supabase.auth.getUser().then(({ data: { user } }) => {
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

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  return null
}
