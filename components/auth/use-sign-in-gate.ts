"use client"

import { useCallback } from "react"
import { usePathname, useRouter } from "next/navigation"

import { useOptionalAuthModal } from "@/components/auth/auth-modal-context"
import { hasSupabaseAuthCookiesClient } from "@/lib/auth/has-supabase-auth-cookies"
import { resolveClientSessionForMutation } from "@/lib/auth/resolve-client-session-for-mutation"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import { createClient } from "@/lib/supabase/client"

type SignInGateOptions = {
  /** Skip the client session probe when the server already knows the viewer is signed out. */
  skipSessionProbe?: boolean
}

/**
 * Opens the login popup when {@link AuthModalProvider} wraps the shell; otherwise redirects to full-page login.
 * Use this instead of signing toasts for gated actions.
 */
export function useSignInGate() {
  const authModal = useOptionalAuthModal()
  const router = useRouter()
  const pathname = usePathname()

  return useCallback(
    (redirectOverride?: string | null, options?: SignInGateOptions) => {
      const resolveRedirect = (): string => {
        const raw = redirectOverride != null ? String(redirectOverride).trim() : ""
        if (raw !== "") return safeRedirectPath(raw)
        const p = pathname != null && pathname !== "" ? pathname : "/"
        const q = typeof window !== "undefined" ? window.location.search : ""
        return safeRedirectPath(p + q)
      }

      const openGate = () => {
        const fullPath = resolveRedirect()
        if (authModal) {
          authModal.openLogin(fullPath)
        } else {
          router.push(`/auth/login?redirect=${encodeURIComponent(fullPath)}`)
        }
      }

      if (options?.skipSessionProbe || !hasSupabaseAuthCookiesClient()) {
        openGate()
        return
      }

      void (async () => {
        const supabase = createClient()
        const session = await resolveClientSessionForMutation(supabase)
        if (session?.user) return
        openGate()
      })()
    },
    [authModal, router, pathname],
  )
}
