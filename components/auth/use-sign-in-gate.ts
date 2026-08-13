"use client"

import { useCallback } from "react"
import { usePathname, useRouter } from "next/navigation"

import { useOptionalAuthModal } from "@/components/auth/auth-modal-context"
import { resolveSellEditUser } from "@/lib/sell-flow/resolve-sell-edit-user"
import { sellPostAuthReturnPath } from "@/lib/sell-flow/post-auth-return-path"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"
import { createClient } from "@/lib/supabase/client"

type SignInGateOptions = {
  /** Skip the client session probe when the server already knows the viewer is signed out. */
  skipSessionProbe?: boolean
  /** Prefer the create-account panel (publish / first-time seller gates). */
  preferSignUp?: boolean
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
        if (raw !== "") return sellPostAuthReturnPath(safeRedirectPath(raw))
        const p = pathname != null && pathname !== "" ? pathname : "/"
        const q = typeof window !== "undefined" ? window.location.search : ""
        return sellPostAuthReturnPath(safeRedirectPath(p + q))
      }

      const openGate = () => {
        const fullPath = resolveRedirect()
        if (authModal) {
          if (options?.preferSignUp) {
            authModal.openSignUp(fullPath)
          } else {
            authModal.openLogin(fullPath)
          }
        } else if (options?.preferSignUp) {
          router.push(`/auth/sign-up?redirect=${encodeURIComponent(fullPath)}`)
        } else {
          router.push(`/auth/login?redirect=${encodeURIComponent(fullPath)}`)
        }
      }

      if (options?.skipSessionProbe) {
        openGate()
        return
      }

      void (async () => {
        const supabase = createClient()
        const user = await resolveSellEditUser(supabase)
        if (user) return
        openGate()
      })()
    },
    [authModal, router, pathname],
  )
}
