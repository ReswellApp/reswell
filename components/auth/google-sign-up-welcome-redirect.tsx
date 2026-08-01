"use client"

import { usePathname } from "next/navigation"
import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import { useClientSearchParams } from "@/hooks/use-client-search-params"
import {
  GOOGLE_NEW_SIGNUP_WELCOME_COMPLETED_KEY,
  GOOGLE_NEW_SIGNUP_WELCOME_REDIRECT_ATTEMPTED_KEY,
  shouldShowGoogleSignUpWelcome,
} from "@/lib/auth/google-sign-up-welcome"
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

    const supabase = createClient()

    const maybeRedirect = async () => {
      if (handledRef.current) return
      try {
        if (sessionStorage.getItem(GOOGLE_NEW_SIGNUP_WELCOME_COMPLETED_KEY) === "1") {
          return
        }
      } catch {
        /* ignore */
      }

      const { data } = await supabase.auth.getSession()
      const user = data.session?.user
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
      if (!session?.user) return
      void maybeRedirect()
    })

    return () => sub.subscription.unsubscribe()
  }, [pathname, searchParams])

  return null
}
