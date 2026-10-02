"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"
import type { User } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/client"
import { useClientSearchParams } from "@/hooks/use-client-search-params"
import {
  GOOGLE_NEW_SIGNUP_WELCOME_COMPLETED_KEY,
  GOOGLE_NEW_SIGNUP_WELCOME_REDIRECT_ATTEMPTED_KEY,
  shouldShowGoogleSignUpWelcome,
} from "@/lib/auth/google-sign-up-welcome"
import { isSellFlowReturnPath } from "@/lib/auth/is-sell-flow-return-path"
import { buildGoogleSignUpSuccessPath, GOOGLE_SIGN_UP_SUCCESS_PATH } from "@/lib/google-ads/sign-up-success-path"

/**
 * Safety net when Supabase falls back to Site URL (`/?code=…`) instead of `/auth/callback`.
 * Sends new Google sign-ups to the welcome page if the server callback was skipped.
 */
export function GoogleSignUpWelcomeRedirect(): null {
  const pathname = usePathname()
  const searchParams = useClientSearchParams()
  const handledRef = useRef(false)

  useEffect(() => {
    if (handledRef.current) return
    if (pathname === GOOGLE_SIGN_UP_SUCCESS_PATH) return
    if (pathname === "/auth/callback") return
    // In-progress listing: stay on /sell so the draft can restore and auto-publish.
    if (isSellFlowReturnPath(pathname ?? "/")) return

    const supabase = createClient()

    const maybeRedirect = async (knownUser?: User | null) => {
      if (handledRef.current) return
      try {
        if (sessionStorage.getItem(GOOGLE_NEW_SIGNUP_WELCOME_COMPLETED_KEY) === "1") {
          return
        }
      } catch {
        /* ignore */
      }

      const user =
        knownUser === undefined
          ? (await supabase.auth.getSession()).data.session?.user
          : knownUser
      if (!user || !shouldShowGoogleSignUpWelcome(user)) return

      // Redirect to the welcome page at most once per session. If the server can't see the
      // session cookie (in-app browser / cookie hiccup), the welcome page bounces back to
      // login — without this guard the two would ping-pong into "This page couldn't load".
      try {
        if (sessionStorage.getItem(GOOGLE_NEW_SIGNUP_WELCOME_REDIRECT_ATTEMPTED_KEY) === "1") {
          return
        }
        sessionStorage.setItem(GOOGLE_NEW_SIGNUP_WELCOME_REDIRECT_ATTEMPTED_KEY, "1")
      } catch {
        /* sessionStorage unavailable: fall through (single mount is still guarded by handledRef) */
      }

      handledRef.current = true
      const query = searchParams.toString()
      const returnPath = `${pathname ?? "/"}${query ? `?${query}` : ""}`
      window.location.replace(buildGoogleSignUpSuccessPath(returnPath))
    }

    void maybeRedirect()

    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event !== "SIGNED_IN" && event !== "INITIAL_SESSION") return
      const user = session?.user
      if (!user) return
      // INITIAL_SESSION runs while the auth client holds its lock. A nested
      // getSession() from here never returns on Chrome.
      window.setTimeout(() => {
        void maybeRedirect(user)
      }, 0)
    })

    return () => sub.subscription.unsubscribe()
  }, [pathname, searchParams])

  return null
}
