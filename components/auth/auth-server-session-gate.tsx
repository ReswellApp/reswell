"use client"

import { useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import { AuthTransitionShell } from "@/components/auth/auth-transition-shell"
import { waitForServerSessionReady } from "@/lib/auth/wait-for-server-session-ready"

type AuthServerSessionGateProps = {
  /** Called when the server still cannot see a session after polling. */
  onTimeout: () => void
  /** Re-run the server component once cookies are visible (default). */
  onReady?: () => void
}

/**
 * Server rendered before auth cookies are on the request (common right after OAuth).
 * Polls `/api/auth/session-ready` instead of bouncing straight to login.
 */
export function AuthServerSessionGate({
  onTimeout,
  onReady,
}: AuthServerSessionGateProps) {
  const router = useRouter()
  const handledRef = useRef(false)

  useEffect(() => {
    if (handledRef.current) return
    handledRef.current = true

    void (async () => {
      const ready = await waitForServerSessionReady({
        maxAttempts: 100,
        msBetween: 50,
      })
      if (ready) {
        if (onReady) {
          onReady()
        } else {
          router.refresh()
        }
        return
      }
      onTimeout()
    })()
  }, [onReady, onTimeout, router])

  return <AuthTransitionShell ariaLabel="Loading your account" />
}
