import type { Session } from "@supabase/supabase-js"
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { signInWithAppleNative } from "@/lib/apple-sign-in"
import { signInWithGoogleNative, signOutGoogleNative } from "@/lib/google-sign-in"
import { getSupabase } from "@/lib/supabase"

type SignUpInput = {
  email: string
  password: string
  firstName: string
  lastName: string
}

type AuthContextValue = {
  ready: boolean
  configured: boolean
  session: Session | null
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (input: SignUpInput) => Promise<string | null>
  signInWithGoogle: () => Promise<string | null>
  signInWithApple: () => Promise<string | null>
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
      async signUp({ email, password, firstName, lastName }) {
        if (!supabase) return "Supabase is not configured in this build."
        const trimmedFirst = firstName.trim()
        const trimmedLast = lastName.trim()
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              display_name: signUpDisplayName(trimmedFirst, trimmedLast),
              first_name: trimmedFirst,
              last_name: trimmedLast,
            },
          },
        })
        if (error) return error.message
        if (!data.session) return "Check your email to finish creating your account."
        return null
      },
      async signInWithGoogle() {
        if (!supabase) return "Supabase is not configured in this build."
        const message = await signInWithGoogleNative(supabase)
        return message || null
      },
      async signInWithApple() {
        if (!supabase) return "Supabase is not configured in this build."
        const message = await signInWithAppleNative(supabase)
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

function signUpDisplayName(firstName: string, lastName: string): string {
  const lastInitial = [...lastName][0]?.toUpperCase() ?? ""
  const primary = `${lastInitial}${firstName}`
  if (primary.length >= 5) return primary
  const compact = `${firstName}${lastName}`.replace(/\s+/g, "")
  if (compact.length >= 5) return compact
  return `${firstName} ${lastName}`.trim()
}
