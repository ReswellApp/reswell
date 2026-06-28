"use client"

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/client"
import { resolveClientSessionForMutation } from "@/lib/auth/resolve-client-session-for-mutation"
import { useOptionalAuthModal } from "@/components/auth/auth-modal-context"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"

type SellAuthPhase = "checking" | "authed" | "blocked"

function sellReturnPath(pathname: string | null): string {
  const path = pathname != null && pathname !== "" ? pathname : "/sell"
  const query = typeof window !== "undefined" ? window.location.search : ""
  return safeRedirectPath(`${path}${query}`)
}

export function SellAuthGate({ children }: { children: ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const authModal = useOptionalAuthModal()
  const supabase = useMemo(() => createClient(), [])
  const [phase, setPhase] = useState<SellAuthPhase>("checking")
  const authPromptedRef = useRef(false)
  const authedRef = useRef(false)

  const returnPath = useMemo(() => sellReturnPath(pathname), [pathname])

  useEffect(() => {
    let mounted = true
    authPromptedRef.current = false

    const openAuthModal = () => {
      if (authPromptedRef.current) return
      authPromptedRef.current = true
      const dest = sellReturnPath(pathname)
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

    // Navigating between /sell/* routes should not unmount an in-progress listing form.
    if (authedRef.current) {
      void verifySession().then((ok) => {
        if (!mounted) return
        if (ok) return
        authedRef.current = false
        setPhase("blocked")
        openAuthModal()
      })
      return () => {
        mounted = false
      }
    }

    setPhase("checking")

    void verifySession().then((ok) => {
      if (!mounted) return
      if (ok) {
        authedRef.current = true
        setPhase("authed")
        return
      }
      setPhase("blocked")
      openAuthModal()
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
  }, [authModal, pathname, router, supabase])

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
    return (
      <main className="flex flex-1 items-center justify-center bg-background py-24">
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
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              Sign in to sell on Reswell
            </h1>
            <p className="text-sm leading-relaxed text-muted-foreground">
              Create a free account or sign in to list surfboards, fins, and other gear.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:flex-row sm:justify-center">
            <Button type="button" size="lg" className="w-full sm:w-auto" onClick={openAuth}>
              Sign in or create account
            </Button>
            <Button type="button" variant="outline" size="lg" className="w-full sm:w-auto" asChild>
              <Link href="/">Back to shopping</Link>
            </Button>
          </div>
        </div>
      </main>
    )
  }

  return children
}
