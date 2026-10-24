import type { SupabaseClient } from "@supabase/supabase-js"
import * as ExpoLinking from "expo-linking"
import { Linking } from "react-native"

/** OAuth return URL for this build (dev client vs standalone). */
export function googleOAuthRedirectUri(): string {
  return ExpoLinking.createURL("auth/callback")
}

function isOAuthCallbackUrl(url: string): boolean {
  try {
    const path = ExpoLinking.parse(url).path ?? ""
    return path.includes("auth/callback") || url.includes("auth/callback")
  } catch {
    return url.includes("auth/callback")
  }
}

type InAppAuthResult =
  | { ok: true; callbackUrl: string }
  | { ok: false; cancelled: true }
  | { ok: false; cancelled: false; message: string }

/**
 * iOS: ASWebAuthenticationSession (sheet from the bottom). Android: Chrome Custom Tab.
 * Falls back to full Safari when the native module is missing (rebuild dev client for in-app sheet).
 */
async function openGoogleOAuthInApp(authUrl: string, redirectTo: string): Promise<InAppAuthResult | null> {
  try {
    const WebBrowser = await import("expo-web-browser")
    WebBrowser.maybeCompleteAuthSession()
    const result = await WebBrowser.openAuthSessionAsync(authUrl, redirectTo)
    if (result.type === "success") return { ok: true, callbackUrl: result.url }
    if (result.type === "cancel" || result.type === "dismiss") return { ok: false, cancelled: true }
    return { ok: false, cancelled: false, message: "Google sign-in did not complete." }
  } catch {
    return null
  }
}

function waitForOAuthDeepLink(supabase: SupabaseClient, authUrl: string): Promise<string | null> {
  return new Promise((resolve) => {
    let settled = false
    const timeoutMs = 5 * 60 * 1000

    const finish = (message: string | null) => {
      if (settled) return
      settled = true
      subscription.remove()
      clearTimeout(timeout)
      resolve(message)
    }

    const onUrl = ({ url }: { url: string }) => {
      if (!isOAuthCallbackUrl(url)) return
      void finishOAuthReturnUrl(supabase, url).then(finish)
    }

    const subscription = Linking.addEventListener("url", onUrl)
    const timeout = setTimeout(() => finish("Google sign-in timed out. Try again."), timeoutMs)

    void (async () => {
      const initial = await Linking.getInitialURL()
      if (initial && isOAuthCallbackUrl(initial)) {
        finish(await finishOAuthReturnUrl(supabase, initial))
        return
      }
      if (!(await Linking.canOpenURL(authUrl))) {
        finish("Cannot open the sign-in page on this device.")
        return
      }
      await Linking.openURL(authUrl)
    })()
  })
}

/**
 * Same Supabase Google OAuth as the website (`signInWithOAuth`). Prefer in-app auth sheet;
 * uses repo `NEXT_PUBLIC_SUPABASE_*` only.
 *
 * Add `googleOAuthRedirectUri()` to Supabase → Auth → Redirect URLs.
 */
export async function signInWithGoogleNative(supabase: SupabaseClient): Promise<string | null> {
  const redirectTo = googleOAuthRedirectUri()

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

  const inApp = await openGoogleOAuthInApp(data.url, redirectTo)
  if (inApp) {
    if (inApp.ok) return finishOAuthReturnUrl(supabase, inApp.callbackUrl)
    if (inApp.cancelled) return null
    return inApp.message
  }

  return waitForOAuthDeepLink(supabase, data.url)
}

/** Deep link return while the app is open or after cold start. */
export async function finishOAuthReturnUrl(
  supabase: SupabaseClient,
  url: string,
): Promise<string | null> {
  const { data: existing } = await supabase.auth.getSession()
  if (existing.session) return null

  const parsed = ExpoLinking.parse(url)
  const queryError =
    typeof parsed.queryParams?.error_description === "string"
      ? parsed.queryParams.error_description
      : typeof parsed.queryParams?.error === "string"
        ? parsed.queryParams.error
        : null
  if (queryError) return queryError

  const code =
    typeof parsed.queryParams?.code === "string"
      ? parsed.queryParams.code
      : new URL(url).searchParams.get("code")
  if (!code) return "Sign-in callback did not include an authorization code."

  const { error } = await supabase.auth.exchangeCodeForSession(code)
  return error?.message ?? null
}

export async function signOutGoogleNative(): Promise<void> {
  // Browser OAuth has no separate Google SDK session to clear.
}
