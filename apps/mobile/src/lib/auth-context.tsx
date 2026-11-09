import type { Session } from "@supabase/supabase-js"
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { Platform } from "react-native"
import { registerAppleAccount, registerEmailAccount, registerGoogleAccount } from "@/lib/api"
import { obtainAppleIdCredential, signInWithAppleNative } from "@/lib/apple-sign-in"
import { obtainGoogleIdCredential, signInWithGoogleNative, signOutGoogleNative } from "@/lib/google-sign-in"
import { unregisterPushToken } from "@/lib/push-token"
import { getSupabase } from "@/lib/supabase"

export type SignUpInput = {
  email: string
  password: string
  firstName: string
  lastName: string
  username: string
  marketingOptIn: boolean
  acceptedTerms: boolean
}

export type GoogleSignUpInput = {
  marketingOptIn: boolean
  acceptedTerms: boolean
}

export type AppleSignUpInput = {
  marketingOptIn: boolean
  acceptedTerms: boolean
}

export type SignUpResult =
  | { status: "signed_in" }
  | { status: "confirm_email" }
  | { status: "cancelled" }
  | { status: "error"; message: string }

type AuthContextValue = {
  ready: boolean
  configured: boolean
  session: Session | null
  signIn: (email: string, password: string) => Promise<string | null>
  signUp: (input: SignUpInput) => Promise<SignUpResult>
  signUpWithGoogle: (input: GoogleSignUpInput) => Promise<SignUpResult>
  signUpWithApple: (input: AppleSignUpInput) => Promise<SignUpResult>
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
      async signUp(input) {
        if (!supabase) return { status: "error", message: "Supabase is not configured in this build." }
        try {
          const result = await registerEmailAccount({
            email: input.email.trim(),
            password: input.password,
            first_name: input.firstName.trim(),
            last_name: input.lastName.trim(),
            username: input.username.trim(),
            marketing_opt_in: input.marketingOptIn,
            accepted_terms: input.acceptedTerms,
          })
          if (result.status === "confirm_email") return { status: "confirm_email" }
          if (!result.access_token || !result.refresh_token) {
            return { status: "error", message: "Couldn't create your account." }
          }
          const { error } = await supabase.auth.setSession({
            access_token: result.access_token,
            refresh_token: result.refresh_token,
          })
          if (error) return { status: "error", message: error.message }
          return { status: "signed_in" }
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : "Couldn't create your account."
          return { status: "error", message }
        }
      },
      async signUpWithGoogle(input) {
        if (!supabase) return { status: "error", message: "Supabase is not configured in this build." }
        try {
          if (Platform.OS === "web") {
            const message = await signInWithGoogleNative(supabase)
            if (message) return { status: "error", message }
            return { status: "signed_in" }
          }

          const credential = await obtainGoogleIdCredential()
          if (!credential.ok) {
            if (!credential.message) return { status: "cancelled" }
            return { status: "error", message: credential.message }
          }

          const result = await registerGoogleAccount({
            id_token: credential.credential.idToken,
            ...(credential.credential.accessToken ? { access_token: credential.credential.accessToken } : {}),
            ...(credential.credential.nonce ? { nonce: credential.credential.nonce } : {}),
            marketing_opt_in: input.marketingOptIn,
            accepted_terms: input.acceptedTerms,
          })
          if (!result.access_token || !result.refresh_token) {
            return { status: "error", message: "Couldn't create your account." }
          }
          const { error } = await supabase.auth.setSession({
            access_token: result.access_token,
            refresh_token: result.refresh_token,
          })
          if (error) return { status: "error", message: error.message }
          return { status: "signed_in" }
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : "Couldn't create your account."
          return { status: "error", message }
        }
      },
      async signUpWithApple(input) {
        if (!supabase) return { status: "error", message: "Supabase is not configured in this build." }
        try {
          const credential = await obtainAppleIdCredential()
          if (!credential.ok) {
            if (!credential.message) return { status: "cancelled" }
            return { status: "error", message: credential.message }
          }

          const result = await registerAppleAccount({
            id_token: credential.credential.idToken,
            nonce: credential.credential.nonce,
            marketing_opt_in: input.marketingOptIn,
            accepted_terms: input.acceptedTerms,
          })
          if (!result.access_token || !result.refresh_token) {
            return { status: "error", message: "Couldn't create your account." }
          }
          const { error } = await supabase.auth.setSession({
            access_token: result.access_token,
            refresh_token: result.refresh_token,
          })
          if (error) return { status: "error", message: error.message }
          return { status: "signed_in" }
        } catch (cause) {
          const message = cause instanceof Error ? cause.message : "Couldn't create your account."
          return { status: "error", message }
        }
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
        await unregisterPushToken(session?.access_token)
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
