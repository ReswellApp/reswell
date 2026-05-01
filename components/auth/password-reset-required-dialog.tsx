"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import {
  PASSWORD_RESET_QUERY_KEY,
  PASSWORD_RESET_QUERY_VALUE,
} from "@/lib/auth/password-reset-landing-flag"
import { accessTokenIndicatesPasswordRecovery } from "@/lib/auth/access-token-password-recovery"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  UpdatePasswordFormFields,
  UpdatePasswordInvalidSessionActions,
} from "@/components/auth/update-password-form-fields"

function stripPasswordResetQuery(pathname: string, searchParams: URLSearchParams) {
  const next = new URLSearchParams(searchParams.toString())
  next.delete(PASSWORD_RESET_QUERY_KEY)
  const q = next.toString()
  return q ? `${pathname}?${q}` : pathname
}

async function pollForSession(msBetween: number, maxAttempts: number) {
  const supabase = createClient()
  for (let i = 0; i < maxAttempts; i += 1) {
    const { data } = await supabase.auth.getSession()
    if (data.session?.access_token) return data.session
    await new Promise((r) => setTimeout(r, msBetween))
  }
  return null
}

function PasswordResetRequiredDialogInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()
  const [open, setOpen] = useState(false)
  const [phase, setPhase] = useState<"idle" | "waiting_session" | "ready">("idle")
  const [sessionValid, setSessionValid] = useState(false)
  const strippedRef = useRef(false)

  const urlRequestsReset = useMemo(
    () => searchParams.get(PASSWORD_RESET_QUERY_KEY) === PASSWORD_RESET_QUERY_VALUE,
    [searchParams],
  )

  const applySnapshot = useCallback(
    (session: { access_token?: string } | null | undefined) => {
      const token = session?.access_token ?? null
      const recoveryJwt = accessTokenIndicatesPasswordRecovery(token)
      const showForJwt = !!token && recoveryJwt
      const showForLanding = !!token && urlRequestsReset

      if (urlRequestsReset && !token) {
        setOpen(true)
        setPhase("waiting_session")
        setSessionValid(false)
        return
      }

      setPhase("ready")
      setSessionValid(!!token)
      const shouldOpen = showForJwt || showForLanding
      setOpen(shouldOpen)

      if (shouldOpen && urlRequestsReset && token && typeof window !== "undefined" && !strippedRef.current) {
        strippedRef.current = true
        const live = new URLSearchParams(window.location.search)
        const clean = stripPasswordResetQuery(pathname || "/", live)
        window.history.replaceState(window.history.state, "", clean)
      }
    },
    [pathname, urlRequestsReset],
  )

  useEffect(() => {
    strippedRef.current = false
    const supabase = createClient()
    let cancelled = false

    void (async () => {
      let { data } = await supabase.auth.getSession()
      if (cancelled) return
      let session = data.session ?? null

      if (urlRequestsReset && !session?.access_token) {
        applySnapshot(null)
        session = await pollForSession(75, 40)
        if (cancelled) return
      }

      if (urlRequestsReset && !session?.access_token) {
        setPhase("ready")
        setSessionValid(false)
        setOpen(true)
        if (typeof window !== "undefined" && !strippedRef.current) {
          strippedRef.current = true
          const live = new URLSearchParams(window.location.search)
          const clean = stripPasswordResetQuery(pathname || "/", live)
          window.history.replaceState(window.history.state, "", clean)
        }
        return
      }

      applySnapshot(session ?? undefined)
    })()

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (
        event === "PASSWORD_RECOVERY" ||
        event === "SIGNED_IN" ||
        event === "INITIAL_SESSION" ||
        event === "TOKEN_REFRESHED"
      ) {
        applySnapshot(session ?? undefined)
      }
      if (event === "SIGNED_OUT") {
        setOpen(false)
        setSessionValid(false)
        setPhase("ready")
      }
    })

    return () => {
      cancelled = true
      data.subscription.unsubscribe()
    }
  }, [applySnapshot, pathname, urlRequestsReset])

  const handleSuccess = useCallback(() => {
    setOpen(false)
    setPhase("ready")
  }, [])

  const title =
    phase === "waiting_session"
      ? "Opening password reset…"
      : sessionValid
        ? "Set new password"
        : "Link expired or invalid"

  const description =
    phase === "waiting_session"
      ? "Hang on — we’re finishing sign-in from your email link."
      : sessionValid
        ? "Choose a strong password you haven’t used elsewhere."
        : "Open the reset link from your email again, or request a new one."

  return (
    <Dialog open={open} onOpenChange={() => {}}>
      <DialogContent
        showCloseButton={false}
        overlayClassName="z-[110]"
        className="z-[110] max-h-[min(90vh,720px)] w-[calc(100%-2rem)] max-w-md overflow-y-auto p-6 sm:p-8"
        onPointerDownOutside={(e) => e.preventDefault()}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {phase === "waiting_session" ? null : sessionValid ? (
          <UpdatePasswordFormFields onSuccess={handleSuccess} />
        ) : (
          <UpdatePasswordInvalidSessionActions />
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Modal for setting a new password after the user follows the Supabase reset link. */
export function PasswordResetRequiredDialog() {
  return (
    <Suspense fallback={null}>
      <PasswordResetRequiredDialogInner />
    </Suspense>
  )
}
