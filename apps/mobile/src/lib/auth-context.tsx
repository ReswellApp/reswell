import type { Session, SupabaseClient } from "@supabase/supabase-js"
import * as AppleAuthentication from "expo-apple-authentication"
import * as Linking from "expo-linking"
import * as WebBrowser from "expo-web-browser"
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react"
import { getSupabase } from "@/lib/supabase"

WebBrowser.maybeCompleteAuthSession()

type AuthContextValue = {
  ready: boolean
  configured: boolean
  session: Session | null
  signIn: (email: string, password: string) => Promise<string | null>
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
      async signInWithGoogle() {
        if (!supabase) return "Supabase is not configured in this build."
        const redirectTo = Linking.createURL("auth/callback")
        const { data, error } = await supabase.auth.signInWithOAuth({
          provider: "google",
          options: {
            redirectTo,
            skipBrowserRedirect: true,
            queryParams: { prompt: "select_account" },
          },
        })
        if (error) return error.message
        if (!data.url) return "Could not start Google sign-in."
        const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
        if (result.type === "cancel" || result.type === "dismiss") return null
        if (result.type !== "success") return "Google sign-in did not finish."
        return finishSupabaseOAuth(supabase, result.url)
      },
      async signInWithApple() {
        if (!supabase) return "Supabase is not configured in this build."
        const available = await AppleAuthentication.isAvailableAsync()
        if (!available) return "Sign in with Apple is not available on this device."
        try {
          const credential = await AppleAuthentication.signInAsync({
            requestedScopes: [
              AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
              AppleAuthentication.AppleAuthenticationScope.EMAIL,
            ],
          })
          if (!credential.identityToken) return "Apple did not return a sign-in token."
          const { error } = await supabase.auth.signInWithIdToken({
            provider: "apple",
            token: credential.identityToken,
          })
          return error?.message ?? null
        } catch (error) {
          if (
            error &&
            typeof error === "object" &&
            "code" in error &&
            error.code === "ERR_REQUEST_CANCELED"
          ) {
            return null
          }
          return error instanceof Error ? error.message : "Apple sign-in failed."
        }
      },
      async signOut() {
        if (!supabase) return
        await supabase.auth.signOut()
      },
    }),
    [ready, session, supabase],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

function oauthParam(url: string, name: string): string | null {
  const [beforeHash, hash = ""] = url.split("#")
  const query = beforeHash.split("?")[1] ?? ""
  return new URLSearchParams(query).get(name) ?? new URLSearchParams(hash).get(name)
}

async function finishSupabaseOAuth(supabase: SupabaseClient, returnedUrl: string): Promise<string | null> {
  const code = oauthParam(returnedUrl, "code")
  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    return error?.message ?? null
  }
  const accessToken = oauthParam(returnedUrl, "access_token")
  const refreshToken = oauthParam(returnedUrl, "refresh_token")
  if (accessToken && refreshToken) {
    const { error } = await supabase.auth.setSession({
      access_token: accessToken,
      refresh_token: refreshToken,
    })
    return error?.message ?? null
  }
  return oauthParam(returnedUrl, "error_description") ?? "Google sign-in did not return a session."
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext)
  if (!value) throw new Error("useAuth must be used within AuthProvider")
  return value
}
