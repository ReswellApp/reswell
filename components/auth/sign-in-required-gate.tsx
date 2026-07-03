"use client"

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { hasSupabaseAuthCookiesClient } from "@/lib/auth/has-supabase-auth-cookies"
import { resolveClientSessionForMutation } from "@/lib/auth/resolve-client-session-for-mutation"
import { useOptionalAuthModal } from "@/components/auth/auth-modal-context"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"

type SignInRequiredPhase = "checking" | "authed" | "blocked"

function currentReturnPath(pathname: string | null, fallbackPath: string): string {
  const path = pathname != null && pathname !== "" ? pathname : fallbackPath
  const query = typeof window !== "undefined" ? window.location.search : ""
  return safeRedirectPath(`${path}${query}`)
}

export type SignInRequiredGateProps = {
  children: ReactNode
  title: string
  description: string
  /** Used when pathname is empty (should not happen in practice). */
  fallbackPath?: string
  backHref?: string
  backLabel?: string
  /**
   * When true, a verified session is remembered while navigating within the same
   * gated subtree (e.g. /sell/*) so listing drafts are not unmounted on route change.
   */
  persistSessionAcrossRoutes?: boolean
}

export function SignInRequiredGate({
  children,
  title,
  description,
  fallbackPath = "/",
  backHref = "/",
  backLabel = "Back to shopping",
  persistSessionAcrossRoutes = false,
}: SignInRequiredGateProps) {
  const router = useRouter()
  const pathname = usePathname()
  const authModal = useOptionalAuthModal()
  const supabase = useMemo(() => createClient(), [])
  const [phase, setPhase] = useState<SignInRequiredPhase>(() => {
    if (typeof document !== "undefined" && !hasSupabaseAuthCookiesClient()) {
      return "blocked"
    }
    return "checking"
  })
  const authPromptedRef = useRef(false)
  const authedRef = useRef(false)

  const returnPath = useMemo(
    () => currentReturnPath(pathname, fallbackPath),
    [fallbackPath, pathname],
  )

  useLayoutEffect(() => {
    let mounted = true
    authPromptedRef.current = false

    const openAuthModal = () => {
      if (authPromptedRef.current) return
      authPromptedRef.current = true
      const dest = currentReturnPath(pathname, fallbackPath)
      if (authModal) {
        authModal.openLogin(dest)
      } else {
        router.replace(`/auth/login?redirect=${encodeURIComponent(dest)}`)
      }
    }

    const verifySession = async (): Promise<boolean> => {
      const session = await resolveClientSessionForMutation(supabase)
      return Boolean(session?.user)
    }

    const applyAuthed = () => {
      authedRef.current = true
      setPhase("authed")
    }

    const applyBlocked = () => {
      setPhase("blocked")
      openAuthModal()
    }

    if (persistSessionAcrossRoutes && authedRef.current) {
      void verifySession().then((ok) => {
        if (!mounted) return
        if (ok) return
        authedRef.current = false
        applyBlocked()
      })
      return () => {
        mounted = false
      }
    }

    const likelyGuest = !hasSupabaseAuthCookiesClient()
    if (likelyGuest) {
      setPhase("blocked")
      openAuthModal()
    }

    void verifySession().then((ok) => {
      if (!mounted) return
      if (ok) {
        applyAuthed()
        return
      }
      if (!likelyGuest) {
        applyBlocked()
      }
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        authedRef.current = true
        setPhase("authed")
      } else if (_event === "SIGNED_OUT") {
        authedRef.current = false
        setPhase("blocked")
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [authModal, fallbackPath, pathname, persistSessionAcrossRoutes, router, supabase])

  const openAuth = () => {
    authPromptedRef.current = false
    if (authModal) {
      authModal.openLogin(returnPath)
      authPromptedRef.current = true
      return
    }
    router.push(`/auth/login?redirect=${encodeURIComponent(returnPath)}`)
  }

  if (phase === "checking") {
    return null
  }

  if (phase === "blocked") {
    return (
      <main className="flex flex-1 items-center justify-center bg-background px-4 py-24">
        <div className="mx-auto flex max-w-md flex-col items-center gap-5 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Button type="button" size="lg" className="w-full sm:w-auto" onClick={openAuth}>
              Sign in or create account
            </Button>
            <Button type="button" variant="outline" size="lg" className="w-full sm:w-auto" asChild>
              <Link href={backHref}>{backLabel}</Link>
            </Button>
          </div>
        </div>
      </main>
    )
  }

  return children
}
