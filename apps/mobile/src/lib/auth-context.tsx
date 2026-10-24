import type { Session } from "@supabase/supabase-js"
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { signInWithGoogleNative, signOutGoogleNative } from "@/lib/google-sign-in"
import { getSupabase } from "@/lib/supabase"

type AuthContextValue = {
  ready: boolean
  configured: boolean
  session: Session | null
  signIn: (email: string, password: string) => Promise<string | null>
  signInWithGoogle: () => Promise<string | null>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const supabase = getSupabase()
  const [ready, setReady] = useState(!supabase)
  const [session, setSession] = useState<Session | null>(null)

  useEffect(() => {
    if (!supabase) return
    let active = true
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next)
    })
    return () => {
      active = false
      data.subscription.unsubscribe()
    }
  }, [supabase])

  const value = useMemo<AuthContextValue>(
    () => ({
      ready,
      configured: Boolean(supabase),
      session,
      async signIn(email, password) {
        if (!supabase) return "Supabase is not configured in this build."
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        })
        return error?.message ?? null
      },
      async signInWithGoogle() {
        if (!supabase) return "Supabase is not configured in this build."
        const message = await signInWithGoogleNative(supabase)
        return message || null
      },
      async signOut() {
        await signOutGoogleNative()
        if (!supabase) return
        await supabase.auth.signOut()
      },
    }),
    [ready, session, supabase],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error("useAuth must be used within AuthProvider")
  return value
}
