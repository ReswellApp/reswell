"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Loader2 } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { ProfileCompletionFormFields } from "@/components/auth/profile-completion-form-fields"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import {
  fetchProfileCompletionRow,
  resolveGoogleProfileSetupRequired,
  type ProfileCompletionRow,
} from "@/lib/auth/profile-completion"
import { waitForClientSession } from "@/lib/auth/wait-for-client-session"
import type { User } from "@supabase/supabase-js"

export function CompleteProfilePagePanel() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const supabase = useMemo(() => createClient(), [])
  const [phase, setPhase] = useState<"loading" | "ready" | "redirecting">("loading")
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<ProfileCompletionRow | null>(null)

  const nextPath = safeRedirectPath(searchParams.get("next"))

  useEffect(() => {
    let cancelled = false

    void (async () => {
      let resolvedUser =
        (await supabase.auth.getSession()).data.session?.user ?? null
      if (!resolvedUser) {
        const session = await waitForClientSession({ supabase })
        if (cancelled) return
        resolvedUser = session?.user ?? null
      }

      if (cancelled) return

      if (!resolvedUser) {
        router.replace(`/auth/login?redirect=${encodeURIComponent(`/auth/complete-profile?next=${encodeURIComponent(nextPath)}`)}`)
        return
      }

      const needsSetup = await resolveGoogleProfileSetupRequired(supabase, resolvedUser)
      if (cancelled) return

      if (!needsSetup) {
        setPhase("redirecting")
        router.replace(nextPath)
        return
      }

      const { profile: row } = await fetchProfileCompletionRow(supabase, resolvedUser.id)
      if (cancelled) return

      setUser(resolvedUser)
      setProfile(
        row ?? {
          display_name: null,
          avatar_url: null,
          profile_completed_at: null,
          email: resolvedUser.email ?? null,
        },
      )
      setPhase("ready")
    })()

    return () => {
      cancelled = true
    }
  }, [nextPath, router, supabase])

  if (phase === "loading" || phase === "redirecting") {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6">
        <Loader2 className="h-8 w-8 animate-spin text-primary" aria-hidden />
      </div>
    )
  }

  if (!user || !profile) {
    return (
      <div className="flex min-h-svh w-full items-center justify-center p-6">
        <p className="text-sm text-muted-foreground">Could not load your profile. Please refresh.</p>
      </div>
    )
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-md">
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Choose your username</CardTitle>
            <CardDescription>
              Pick a username other members will see on Reswell. Add a profile photo if you&apos;d like.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ProfileCompletionFormFields
              user={user}
              profile={profile}
              onSuccess={() => {
                setPhase("redirecting")
                router.replace(nextPath)
              }}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
