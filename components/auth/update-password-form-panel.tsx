"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CheckCircle2 } from "lucide-react"
import { SiteWordmarkLink } from "@/components/site-wordmark-link"
import { AuthTransitionShell } from "@/components/auth/auth-transition-shell"
import {
  UpdatePasswordFormFields,
  UpdatePasswordInvalidSessionActions,
} from "@/components/auth/update-password-form-fields"
import { createClient } from "@/lib/supabase/client"
import { waitForClientSession } from "@/lib/auth/wait-for-client-session"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"

type Phase = "checking" | "ready" | "success"

export function UpdatePasswordFormPanel() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>("checking")
  const [sessionValid, setSessionValid] = useState(false)

  const evaluateSession = useCallback((accessToken: string | null | undefined) => {
    const ok = !!accessToken
    setSessionValid(ok)
    setPhase("ready")
    return ok
  }, [])

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    void (async () => {
      let session = (await supabase.auth.getSession()).data.session
      if (!session?.access_token) {
        session = await waitForClientSession({ supabase, maxAttempts: 40, msBetween: 75 })
      }
      if (cancelled) return
      evaluateSession(session?.access_token ?? null)
    })()

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "PASSWORD_RECOVERY" ||
        event === "SIGNED_IN" ||
        event === "INITIAL_SESSION" ||
        event === "TOKEN_REFRESHED"
      ) {
        evaluateSession(session?.access_token ?? null)
      }
      if (event === "SIGNED_OUT") {
        setSessionValid(false)
        setPhase("ready")
      }
    })

    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [evaluateSession])

  const handleSuccess = useCallback(() => {
    setPhase("success")
  }, [])

  useEffect(() => {
    if (phase !== "success") return
    const timer = window.setTimeout(() => {
      router.push("/dashboard")
      router.refresh()
    }, 2400)
    return () => window.clearTimeout(timer)
  }, [phase, router])

  if (phase === "checking") {
    return <AuthTransitionShell ariaLabel="Verifying your reset link" />
  }

  if (phase === "success") {
    return (
      <AuthPageShell>
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50">
              <CheckCircle2 className="h-7 w-7 text-emerald-600" aria-hidden />
            </div>
            <CardTitle className="text-2xl">Password updated</CardTitle>
            <CardDescription>
              You&apos;re all set. Taking you to your dashboard…
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button asChild className="w-full">
              <Link href="/dashboard">Continue to dashboard</Link>
            </Button>
          </CardContent>
        </Card>
      </AuthPageShell>
    )
  }

  if (!sessionValid) {
    return (
      <AuthPageShell>
        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Link expired or invalid</CardTitle>
            <CardDescription>
              Reset links expire quickly for security. Request a new one and open it from your
              email right away.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <UpdatePasswordInvalidSessionActions />
          </CardContent>
        </Card>
      </AuthPageShell>
    )
  }

  return (
    <AuthPageShell>
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl">Set new password</CardTitle>
          <CardDescription>
            Choose a strong password you haven&apos;t used elsewhere.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <UpdatePasswordFormFields onSuccess={handleSuccess} />
          <p className="mt-6 text-center text-sm text-muted-foreground">
            <Link href="/auth/login" className="underline underline-offset-4">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </AuthPageShell>
  )
}

function AuthPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center gap-8 bg-background p-6 md:p-10">
      <SiteWordmarkLink href="/" className="shrink-0" />
      <div className="w-full max-w-sm">{children}</div>
    </div>
  )
}
