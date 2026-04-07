"use client"

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import { AuthModal } from "@/components/auth/auth-modal"
import { safeRedirectPath } from "@/lib/auth/safe-redirect"

type Mode = "login" | "sign-up"

export type AuthModalContextValue = {
  openLogin: (redirect?: string | null) => void
  openSignUp: (redirect?: string | null) => void
  close: () => void
}

const AuthModalContext = createContext<AuthModalContextValue | null>(null)

export function AuthModalProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<Mode>("login")
  const [redirectTo, setRedirectTo] = useState("/dashboard")

  const openLogin = useCallback((redirect?: string | null) => {
    setMode("login")
    setRedirectTo(safeRedirectPath(redirect ?? null))
    setOpen(true)
  }, [])

  const openSignUp = useCallback((redirect?: string | null) => {
    setMode("sign-up")
    setRedirectTo(safeRedirectPath(redirect ?? null))
    setOpen(true)
  }, [])

  const close = useCallback(() => setOpen(false), [])

  const value = useMemo(
    () => ({ openLogin, openSignUp, close }),
    [openLogin, openSignUp, close],
  )

  return (
    <AuthModalContext.Provider value={value}>
      {children}
      <AuthModal
        open={open}
        onOpenChange={setOpen}
        mode={mode}
        onModeChange={setMode}
        redirectTo={redirectTo}
        onClose={close}
      />
    </AuthModalContext.Provider>
  )
}

export function useAuthModal(): AuthModalContextValue {
  const ctx = useContext(AuthModalContext)
  if (!ctx) {
    throw new Error("useAuthModal must be used within AuthModalProvider")
  }
  return ctx
}

/** Null when this client subtree is not under {@link AuthModalProvider} (e.g. inside a Server Component slot). */
export function useOptionalAuthModal(): AuthModalContextValue | null {
  return useContext(AuthModalContext)
}
