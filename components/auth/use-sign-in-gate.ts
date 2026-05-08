"use client"

import { useCallback } from "react"
import { usePathname, useRouter } from "next/navigation"

import { useOptionalAuthModal } from "@/components/auth/auth-modal-context"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"

/**
 * Opens the login popup when {@link AuthModalProvider} wraps the shell; otherwise redirects to full-page login.
 * Use this instead of signing toasts for gated actions.
 */
export function useSignInGate() {
  const authModal = useOptionalAuthModal()
  const router = useRouter()
  const pathname = usePathname()

  return useCallback(
    (redirectOverride?: string | null) => {
      let fullPath: string
      const raw = redirectOverride != null ? String(redirectOverride).trim() : ""
      if (raw !== "") {
        fullPath = safeRedirectPath(raw)
      } else {
        const p = pathname != null && pathname !== "" ? pathname : "/"
        const q = typeof window !== "undefined" ? window.location.search : ""
        fullPath = safeRedirectPath(p + q)
      }

      if (authModal) {
        authModal.openLogin(fullPath)
      } else {
        router.push(`/auth/login?redirect=${encodeURIComponent(fullPath)}`)
      }
    },
    [authModal, router, pathname],
  )
}
