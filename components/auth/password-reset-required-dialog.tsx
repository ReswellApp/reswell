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
  const dismissedRef = useRef(false)
  const strippedRef = useRef(false)

  const urlRequestsReset = useMemo(
    () => searchParams.get(PASSWORD_RESET_QUERY_KEY) === PASSWORD_RESET_QUERY_VALUE,
    [searchParams],
  )

  const [dismissed, setDismissed] = useState(false)
  const [open, setOpen] = useState(urlRequestsReset)
  const [phase, setPhase] = useState<"idle" | "checking" | "ready">(
    urlRequestsReset ? "checking" : "idle",
  )
  const [sessionValid, setSessionValid] = useState(false)

  const stripResetQueryFromUrl = useCallback(() => {
    if (typeof window === "undefined" || strippedRef.current) return
    strippedRef.current = true
    const live = new URLSearchParams(window.location.search)
    const clean = stripPasswordResetQuery(pathname || "/", live)
    window.history.replaceState(window.history.state, "", clean)
  }, [pathname])

  const handleDismiss = useCallback(() => {
    dismissedRef.current = true
    setDismissed(true)
    setOpen(false)
    setPhase("ready")
    stripResetQueryFromUrl()
  }, [stripResetQueryFromUrl])

  const applySnapshot = useCallback(
    (session: { access_token?: string } | null | undefined) => {
      if (dismissedRef.current) return

      const token = session?.access_token ?? null
      const recoveryJwt = accessTokenIndicatesPasswordRecovery(token)
      const showForJwt = !!token && recoveryJwt
      const showForLanding = !!token && urlRequestsReset

      setSessionValid(!!token)
      setPhase("ready")
      setOpen(urlRequestsReset || showForJwt || showForLanding)

      if ((showForJwt || showForLanding) && urlRequestsReset && token) {
        stripResetQueryFromUrl()
      }
    },
    [stripResetQueryFromUrl, urlRequestsReset],
  )

  useEffect(() => {
    if (!urlRequestsReset) return
    dismissedRef.current = false
    strippedRef.current = false
    setDismissed(false)
    setOpen(true)
    setPhase("checking")
  }, [urlRequestsReset])

  useEffect(() => {
    const supabase = createClient()
    let cancelled = false

    void (async () => {
      const { data } = await supabase.auth.getSession()
      if (cancelled || dismissedRef.current) return

      let session = data.session ?? null

      if (urlRequestsReset && !session?.access_token) {
        session = await pollForSession(32, 20)
        if (cancelled || dismissedRef.current) return
      }

      if (urlRequestsReset && !session?.access_token) {
        setPhase("ready")
        setSessionValid(false)
        setOpen(true)
        stripResetQueryFromUrl()
        return
      }

      applySnapshot(session ?? undefined)
    })()

    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      if (dismissedRef.current) return
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
  }, [applySnapshot, stripResetQueryFromUrl, urlRequestsReset])

  const handleSuccess = useCallback(() => {
    dismissedRef.current = true
    setDismissed(true)
    setOpen(false)
    setPhase("ready")
    stripResetQueryFromUrl()
  }, [stripResetQueryFromUrl])

  const showPasswordForm =
    sessionValid || (urlRequestsReset && phase === "checking")

  const title = showPasswordForm
    ? "Set new password"
    : "Link expired or invalid"

  const description = showPasswordForm
    ? "Choose a strong password you haven't used elsewhere."
    : "Open the reset link from your email again, or request a new one."

  return (
    <Dialog
      open={open && !dismissed}
      onOpenChange={(next) => {
        if (!next) handleDismiss()
      }}
    >
      <DialogContent
        showCloseButton
        overlayClassName="z-[110] data-[state=open]:animate-none data-[state=closed]:animate-none"
        className="z-[110] max-h-[min(90vh,720px)] w-[calc(100%-2rem)] max-w-md overflow-y-auto p-6 duration-0 data-[state=open]:animate-none data-[state=closed]:animate-none sm:p-8"
        onPointerDownOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-2xl">{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {showPasswordForm ? (
          <UpdatePasswordFormFields onSuccess={handleSuccess} />
        ) : (
          <UpdatePasswordInvalidSessionActions />
        )}
      </DialogContent>
    </Dialog>
  )
}

/** Modal for setting a new password after the user follows the reset link. */
export function PasswordResetRequiredDialog() {
  return (
    <Suspense fallback={null}>
      <PasswordResetRequiredDialogInner />
    </Suspense>
  )
}
