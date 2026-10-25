import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react"
import { AuthSheet } from "@/components/auth-sheet"
import { useAuth } from "@/lib/auth-context"

type AuthContinuation = (accessToken: string) => void

type AuthGateValue = {
  requestAuth: (after?: AuthContinuation) => void
}

const AuthGateContext = createContext<AuthGateValue | null>(null)

export function AuthGateProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const [presented, setPresented] = useState(false)
  const pendingRef = useRef<AuthContinuation | null>(null)
  const sessionRef = useRef(session)
  sessionRef.current = session

  const requestAuth = useCallback((after?: AuthContinuation) => {
    const token = sessionRef.current?.access_token
    if (token) {
      after?.(token)
      return
    }
    pendingRef.current = after ?? null
    setPresented(true)
  }, [])

  const dismiss = useCallback(() => {
    pendingRef.current = null
    setPresented(false)
  }, [])

  useEffect(() => {
    const token = session?.access_token
    if (!token || !presented) return
    const next = pendingRef.current
    pendingRef.current = null
    setPresented(false)
    next?.(token)
  }, [presented, session?.access_token])

  const value = useMemo<AuthGateValue>(() => ({ requestAuth }), [requestAuth])

  return (
    <AuthGateContext.Provider value={value}>
      {children}
      <AuthSheet presented={presented} onDismiss={dismiss} />
    </AuthGateContext.Provider>
  )
}

export function useAuthGate(): AuthGateValue {
  const value = useContext(AuthGateContext)
  if (!value) throw new Error("useAuthGate must be used within AuthGateProvider")
  return value
}
