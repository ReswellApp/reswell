"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { AuthTransitionShell } from "@/components/auth/auth-transition-shell"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import { waitForClientSession } from "@/lib/auth/wait-for-client-session"
import { waitForServerSessionReady } from "@/lib/auth/wait-for-server-session-ready"

type AuthErrorRecoveryPanelProps = {
  errorMessage?: string
  redirectTo?: string
}

/**
 * OAuth/email verification can fail transiently while the session is already valid
 * (double callback hit, cookie lag). Recover silently instead of flashing an error card.
 */
export function AuthErrorRecoveryPanel({
  errorMessage,
  redirectTo = "/dashboard",
}: AuthErrorRecoveryPanelProps) {
  const [phase, setPhase] = useState<"recovering" | "failed">("recovering")
  const handledRef = useRef(false)
  const destination = safeRedirectPath(redirectTo)

  useEffect(() => {
    if (handledRef.current) return
    handledRef.current = true

    void (async () => {
      const session = await waitForClientSession({ maxAttempts: 60, msBetween: 75 })
      if (session?.user) {
        await waitForServerSessionReady({
          maxAttempts: 120,
          msBetween: 50,
        })
        // Client session is enough — full navigation sends cookies even when the probe lagged.
        window.location.replace(destination)
        return
      }

      const serverReady = await waitForServerSessionReady({
        maxAttempts: 120,
        msBetween: 50,
      })
      if (serverReady) {
        window.location.replace(destination)
        return
      }

      setPhase("failed")
    })()
  }, [destination])

  if (phase === "recovering") {
    return <AuthTransitionShell ariaLabel="Completing sign in" />
  }

  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-2xl">
                Sorry, something went wrong.
              </CardTitle>
            </CardHeader>
            <CardContent>
              {errorMessage ? (
                <p className="text-sm text-muted-foreground">
                  Code error: {errorMessage}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  An unspecified error occurred.
                </p>
              )}
              <div className="mt-4 flex gap-2">
                <Link
                  href="/auth/login"
                  className="inline-flex flex-1 items-center justify-center rounded-md bg-black px-4 py-2 text-sm font-medium text-white shadow hover:bg-neutral-800 dark:bg-white dark:text-black dark:hover:bg-neutral-200"
                >
                  Try logging in
                </Link>
                <Link
                  href="/"
                  className="inline-flex flex-1 items-center justify-center rounded-md border border-black bg-transparent px-4 py-2 text-sm font-medium text-black shadow-sm hover:bg-neutral-100 dark:border-white dark:text-white dark:hover:bg-white/10"
                >
                  Go home
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
