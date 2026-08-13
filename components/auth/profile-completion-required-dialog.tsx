"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useRouter, useSearchParams } from "next/navigation"
import type { User } from "@supabase/supabase-js"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { accessTokenIndicatesPasswordRecovery } from "@/lib/auth/access-token-password-recovery"
import { getAuthUserWithRetry } from "@/lib/auth/get-user-with-retry"
import { waitForClientSession } from "@/lib/auth/wait-for-client-session"
import { resolveProfileCompletionReturnPath } from "@/lib/auth/profile-completion-return-path"
import {
  COMPLETE_PROFILE_PATH,
  fetchProfileCompletionRow,
  isGoogleAuthUser,
  profileNeedsCompletion,
  resolveGoogleProfileSetupRequired,
  type ProfileCompletionRow,
} from "@/lib/auth/profile-completion"
import {
  EMAIL_SIGN_UP_SUCCESS_PATH,
  GOOGLE_SIGN_UP_SUCCESS_PATH,
} from "@/lib/google-ads/sign-up-success-path"
import { ProfileCompletionFormFields } from "@/components/auth/profile-completion-form-fields"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  PROFILE_SETUP_MODAL_CONTENT_CLASS,
  PROFILE_SETUP_MODAL_OVERLAY_CLASS,
} from "@/lib/auth/auth-modal-shell-classes"

function ProfileCompletionRequiredDialogInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<"idle" | "waiting_profile" | "ready">("idle")
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<ProfileCompletionRow | null>(null)
  const [blockedByPasswordRecovery, setBlockedByPasswordRecovery] = useState(false)
  const profileSetupDismissedRef = useRef(false)

  const returnPath = useMemo(
    () => resolveProfileCompletionReturnPath(pathname, searchParams),
    [pathname, searchParams],
  )

  const evaluateSession = useCallback(
    async (sessionUser: User | null | undefined, accessToken?: string | null) => {
      if (pathname === COMPLETE_PROFILE_PATH) return
      if (pathname === GOOGLE_SIGN_UP_SUCCESS_PATH) return
      if (pathname === EMAIL_SIGN_UP_SUCCESS_PATH) return
      if (profileSetupDismissedRef.current) return

      const recoveryActive =
        !!accessToken && accessTokenIndicatesPasswordRecovery(accessToken)
      setBlockedByPasswordRecovery(recoveryActive)

      if (!sessionUser || recoveryActive) {
        setOpen(false)
        setUser(null)
        setProfile(null)
        setPhase("ready")
        return
      }

      setPhase("waiting_profile")

      const userResult = await getAuthUserWithRetry(supabase, { attempts: 2 })
      const resolvedUser = userResult.ok ? userResult.user ?? sessionUser : sessionUser

      const needsSetup = await resolveGoogleProfileSetupRequired(supabase, resolvedUser)
      const { profile: row, hasCompletionColumn, error } =
        await fetchProfileCompletionRow(supabase, resolvedUser.id)

      setPhase("ready")

      if (error && !row) {
        console.warn("[profile-completion] profile lookup failed:", error)
        setOpen(false)
        setUser(null)
        setProfile(null)
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

      if (!needsSetup) {
        setOpen(false)
        setUser(null)
        setProfile(null)
        return
      }

      setUser(resolvedUser)
      setProfile(
        row ?? {
          display_name: null,
          avatar_url: null,
          profile_completed_at: null,
          email: resolvedUser.email ?? null,
        },
      )
      setOpen(true)
    },
    [pathname, supabase],
  )

  useEffect(() => {
    if (pathname === COMPLETE_PROFILE_PATH) return
    if (pathname === GOOGLE_SIGN_UP_SUCCESS_PATH) return
    if (pathname === EMAIL_SIGN_UP_SUCCESS_PATH) return

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
      if (event === "SIGNED_OUT") {
        setOpen(false)
        setUser(null)
        setProfile(null)
        setPhase("ready")
        setBlockedByPasswordRecovery(false)
      }
    })

    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [evaluateSession, pathname, supabase])

  const handleSuccess = useCallback(() => {
    profileSetupDismissedRef.current = true
    setOpen(false)
    setUser(null)
    setProfile(null)
    setPhase("ready")

    const query = searchParams.toString()
    const currentPath = `${pathname ?? "/"}${query ? `?${query}` : ""}`
    if (currentPath !== returnPath) {
      router.replace(returnPath)
    }
  }, [pathname, returnPath, router, searchParams])

  const title =
    phase === "waiting_profile" ? "Setting up your account…" : "Choose your username"

  const description =
    phase === "waiting_profile"
      ? "Hang on — we’re finishing Google sign-in."
      : "Pick a username other members will see on Reswell. Add a profile photo if you’d like."

  return (
    <Dialog open={open && !blockedByPasswordRecovery} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        overlayClassName={PROFILE_SETUP_MODAL_OVERLAY_CLASS}
        className={PROFILE_SETUP_MODAL_CONTENT_CLASS}
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {phase === "waiting_profile" ? (
          <div className="flex justify-center py-8" aria-hidden>
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : user && profile ? (
          <ProfileCompletionFormFields user={user} profile={profile} onSuccess={handleSuccess} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

/**
 * Blocking overlay after Google sign-in. Renders above the current page (e.g. homepage)
 * with the same dimmed backdrop as the auth modal — not on a blank /auth screen.
 */
export function ProfileCompletionRequiredDialog() {
  return (
    <Suspense fallback={null}>
      <ProfileCompletionRequiredDialogInner />
    </Suspense>
  )
}
