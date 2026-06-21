"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { AuthTransitionShell } from "@/components/auth/auth-transition-shell"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import { waitForClientSession } from "@/lib/auth/wait-for-client-session"
import { waitForServerSessionReady } from "@/lib/auth/wait-for-server-session-ready"

type AuthSessionCompletionPanelProps = {
  redirectTo?: string
  /** Shown only when session sync exhausts all retries. */
  failureFallback?: ReactNode
  ariaLabel?: string
}

const CLIENT_POLL = { maxAttempts: 80, msBetween: 75 } as const
const SERVER_POLL = { maxAttempts: 160, msBetween: 50 } as const

/**
 * Polls client + server session after OAuth while showing a neutral spinner. Used on
 * `/auth/completing` so users never land on `/auth/error` during a recoverable sign-in.
 */
export function AuthSessionCompletionPanel({
  redirectTo = "/dashboard",
  failureFallback,
  ariaLabel = "Completing sign in",
}: AuthSessionCompletionPanelProps) {
  const [phase, setPhase] = useState<"recovering" | "failed">("recovering")
  const handledRef = useRef(false)
  const destination = safeRedirectPath(redirectTo)

  useEffect(() => {
    if (handledRef.current) return
    handledRef.current = true

    void (async () => {
      const session = await waitForClientSession(CLIENT_POLL)
      if (session?.user) {
        await waitForServerSessionReady(SERVER_POLL)
        window.location.replace(destination)
        return
      }

      const serverReady = await waitForServerSessionReady(SERVER_POLL)
      if (serverReady) {
        window.location.replace(destination)
        return
      }

      setPhase("failed")
    })()
  }, [destination])

  if (phase === "recovering") {
    return <AuthTransitionShell ariaLabel={ariaLabel} />
  }

  if (failureFallback) {
    return failureFallback
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm text-center">
        <h1 className="text-xl font-semibold tracking-tight text-foreground">
          Sign-in is taking longer than expected
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Try again — your account may already be signed in on another tab.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link
            href={`/auth/login?redirect=${encodeURIComponent(destination)}`}
            className="inline-flex h-11 items-center justify-center rounded-full bg-foreground px-5 text-sm font-medium text-background"
          >
            Try again
          </Link>
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-full border border-border px-5 text-sm font-medium text-foreground"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  )
}
