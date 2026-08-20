"use client"

import { useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
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
  // Always probe the session first — Supabase SSR auth cookies are often httpOnly and
  // invisible to document.cookie, so a missing client cookie is not proof of signed-out.
  const [phase, setPhase] = useState<SignInRequiredPhase>("checking")
  const authPromptedRef = useRef(false)
  const authedRef = useRef(false)

  const returnPath = useMemo(
    () => currentReturnPath(pathname, fallbackPath),
    [fallbackPath, pathname],
  )

  useLayoutEffect(() => {
    let mounted = true
    authPromptedRef.current = false

    const verifySession = async (): Promise<boolean> => {
      const session = await resolveClientSessionForMutation(supabase)
      if (session?.user) return true
      // Browser client can miss httpOnly SSR cookies; the server cookie probe
      // is enough to treat this tab as signed in and refresh the RSC tree.
      try {
        const res = await fetch("/api/auth/session-user", {
          credentials: "include",
          cache: "no-store",
        })
        if (!res.ok) return false
        const body = (await res.json()) as { data?: { id?: string } }
        return Boolean(body.data?.id?.trim())
      } catch {
        return false
      }
    }

    const applyAuthed = () => {
      authedRef.current = true
      setPhase("authed")
    }

    const applyBlocked = () => {
      setPhase("blocked")
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

    void verifySession()
      .then((ok) => {
        if (!mounted) return
        if (ok) {
          applyAuthed()
          router.refresh()
          return
        }
        applyBlocked()
      })
      .catch(() => {
        if (!mounted) return
        applyBlocked()
      })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        const wasAuthed = authedRef.current
        authedRef.current = true
        setPhase("authed")
        if (!wasAuthed) router.refresh()
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

  const openSignUp = () => {
    authPromptedRef.current = false
    if (authModal) {
      authModal.openSignUp(returnPath)
      authPromptedRef.current = true
      return
    }
    router.push(`/auth/sign-up?redirect=${encodeURIComponent(returnPath)}`)
  }

  if (phase === "checking") {
    return (
      <main
        className="flex flex-1 items-center justify-center bg-background py-24"
        role="status"
        aria-label="Checking sign-in status"
      >
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <Loader2 className="h-8 w-8 animate-spin" aria-hidden />
          <p className="text-sm">Loading…</p>
        </div>
      </main>
    )
  }

  if (phase === "blocked") {
    return (
      <main className="flex flex-1 items-center justify-center bg-background px-4 py-24">
        <div className="mx-auto flex max-w-md flex-col items-center gap-5 text-center">
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
            <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>
          </div>
          <div className="flex w-full flex-col gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Button type="button" variant="outline" size="lg" className="w-full sm:w-auto" onClick={openSignUp}>
                Sign up
              </Button>
              <Button type="button" size="lg" className="w-full sm:w-auto" onClick={openAuth}>
                Login
              </Button>
            </div>
            <Button type="button" variant="outline" size="lg" className="w-full" asChild>
              <Link href={backHref}>{backLabel}</Link>
            </Button>
          </div>
        </div>
      </main>
    )
  }

  return children
}
