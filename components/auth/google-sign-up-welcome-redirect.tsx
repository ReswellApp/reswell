"use client"

import { usePathname, useSearchParams } from "next/navigation"
import { useEffect, useRef } from "react"
import { createClient } from "@/lib/supabase/client"
import {
  GOOGLE_NEW_SIGNUP_WELCOME_COMPLETED_KEY,
  shouldShowGoogleSignUpWelcome,
} from "@/lib/auth/google-sign-up-welcome"
import { buildGoogleSignUpSuccessPath, GOOGLE_SIGN_UP_SUCCESS_PATH } from "@/lib/google-ads/sign-up-success-path"

/**
 * Safety net when Supabase falls back to Site URL (`/?code=…`) instead of `/auth/callback`.
 * Sends new Google sign-ups to the welcome page if the server callback was skipped.
 */
export function GoogleSignUpWelcomeRedirect(): null {
  const pathname = usePathname()
  const searchParams = useSearchParams()
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

      handledRef.current = true
      const query = searchParams?.toString()
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
