"use client"

import { Suspense, useCallback, useEffect, useMemo } from "react"
import type { User } from "@supabase/supabase-js"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { accessTokenIndicatesPasswordRecovery } from "@/lib/auth/access-token-password-recovery"
import { getAuthUserWithRetry } from "@/lib/auth/get-user-with-retry"
import { waitForClientSession } from "@/lib/auth/wait-for-client-session"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import {
  COMPLETE_PROFILE_PATH,
  fetchProfileCompletionRow,
  isGoogleAuthUser,
  profileNeedsCompletion,
  resolveGoogleProfileSetupRequired,
} from "@/lib/auth/profile-completion"

/**
 * Sends users who still need Google profile setup to {@link COMPLETE_PROFILE_PATH}.
 * The modal UI lives only on that page — this guard never renders a second dialog.
 */
function ProfileCompletionRouteGuardInner() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])

  const redirectToCompleteProfile = useCallback(() => {
    if (pathname === COMPLETE_PROFILE_PATH) return

    const query = searchParams.toString()
    const returnPath =
      pathname && !pathname.startsWith("/auth/")
        ? `${pathname}${query ? `?${query}` : ""}`
        : null
    const next = safeRedirectPath(returnPath)
    router.replace(`${COMPLETE_PROFILE_PATH}?next=${encodeURIComponent(next)}`)
  }, [pathname, router, searchParams])

  const evaluateSession = useCallback(
    async (sessionUser: User | null | undefined, accessToken?: string | null) => {
      if (pathname === COMPLETE_PROFILE_PATH) return

      const recoveryActive =
        !!accessToken && accessTokenIndicatesPasswordRecovery(accessToken)
      if (!sessionUser || recoveryActive) return

      const userResult = await getAuthUserWithRetry(supabase, { attempts: 2 })
      const resolvedUser = userResult.ok ? userResult.user ?? sessionUser : sessionUser

      const needsSetup = await resolveGoogleProfileSetupRequired(supabase, resolvedUser)
      const { profile: row, hasCompletionColumn, error } =
        await fetchProfileCompletionRow(supabase, resolvedUser.id)

      if (error && !row) {
        console.warn("[profile-completion] profile lookup failed:", error)
        return
      }

      if (
        !isGoogleAuthUser(resolvedUser) &&
        hasCompletionColumn &&
        profileNeedsCompletion(row, true)
      ) {
        const completedAt = new Date().toISOString()
        await supabase
          .from("profiles")
          .update({ profile_completed_at: completedAt, updated_at: completedAt })
          .eq("id", resolvedUser.id)
      }

      if (needsSetup) redirectToCompleteProfile()
    },
    [pathname, redirectToCompleteProfile, supabase],
  )

  useEffect(() => {
    if (pathname === COMPLETE_PROFILE_PATH) return

    let cancelled = false

    void (async () => {
      let { data } = await supabase.auth.getSession()
      if (cancelled) return

      let session = data.session ?? null
      if (!session?.user) {
        session = await waitForClientSession({ supabase })
        if (cancelled) return
      }

      await evaluateSession(session?.user ?? null, session?.access_token ?? null)
    })()

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "SIGNED_IN" ||
        event === "INITIAL_SESSION" ||
        event === "USER_UPDATED" ||
        event === "TOKEN_REFRESHED" ||
        event === "PASSWORD_RECOVERY"
      ) {
        void evaluateSession(session?.user ?? null, session?.access_token ?? null)
      }
    })

    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [evaluateSession, pathname, supabase])

  return null
}

export function ProfileCompletionRouteGuard() {
  return (
    <Suspense fallback={null}>
      <ProfileCompletionRouteGuardInner />
    </Suspense>
  )
}
