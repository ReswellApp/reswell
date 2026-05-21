"use client"

import { Suspense, useCallback, useEffect, useMemo, useState } from "react"
import type { User } from "@supabase/supabase-js"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { accessTokenIndicatesPasswordRecovery } from "@/lib/auth/access-token-password-recovery"
import { getAuthUserWithRetry } from "@/lib/auth/get-user-with-retry"
import { waitForClientSession } from "@/lib/auth/wait-for-client-session"
import {
  fetchProfileCompletionRow,
  isGoogleAuthUser,
  profileNeedsCompletion,
  resolveGoogleProfileSetupRequired,
  type ProfileCompletionRow,
} from "@/lib/auth/profile-completion"
import { ProfileCompletionFormFields } from "@/components/auth/profile-completion-form-fields"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

function ProfileCompletionRequiredDialogInner() {
  const supabase = useMemo(() => createClient(), [])
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<"idle" | "waiting_profile" | "ready">("idle")
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<ProfileCompletionRow | null>(null)
  const [blockedByPasswordRecovery, setBlockedByPasswordRecovery] = useState(false)

  const evaluateSession = useCallback(
    async (sessionUser: User | null | undefined, accessToken?: string | null) => {
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
    [supabase],
  )

  useEffect(() => {
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
  }, [evaluateSession, supabase])

  const handleSuccess = useCallback(() => {
    setOpen(false)
    setUser(null)
    setProfile(null)
    setPhase("ready")
  }, [])

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
        overlayClassName="z-[109]"
        className="z-[109] max-h-[min(90vh,720px)] w-[calc(100%-2rem)] max-w-md overflow-y-auto p-6 sm:p-8"
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

/** Blocking modal after Google sign-in for new users to set a username and optional profile photo. */
export function ProfileCompletionRequiredDialog() {
  return (
    <Suspense fallback={null}>
      <ProfileCompletionRequiredDialogInner />
    </Suspense>
  )
}
