import type { SupabaseClient } from "@supabase/supabase-js"
import {
  GoogleSignin,
  isErrorWithCode,
  isSuccessResponse,
  statusCodes,
} from "@react-native-google-signin/google-signin"
import * as ExpoLinking from "expo-linking"
import { Platform } from "react-native"
import { publicGoogleIosClientId, publicGoogleWebClientId } from "@/lib/public-env"

/** OAuth return URL for web and legacy browser flows. */
export function googleOAuthRedirectUri(): string {
  return ExpoLinking.createURL("auth/callback")
}

let googleSignInConfigured = false

function configureNativeGoogleSignIn(): string | null {
  if (googleSignInConfigured) return null

  const webClientId = publicGoogleWebClientId()
  const iosClientId = publicGoogleIosClientId()

  if (!webClientId) {
    return "Google sign-in is not configured (set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in .env.local)."
  }
  if (Platform.OS === "ios" && !iosClientId) {
    return "Google sign-in is not configured (set EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID in .env.local)."
  }

  GoogleSignin.configure({
    webClientId,
    iosClientId: iosClientId || undefined,
    offlineAccess: false,
  })
  googleSignInConfigured = true
  return null
}

function nativeGoogleSignInEnabled(): boolean {
  if (Platform.OS === "web") return false
  if (!publicGoogleWebClientId()) return false
  if (Platform.OS === "ios" && !publicGoogleIosClientId()) return false
  return true
}

async function signInWithGoogleNativeSdk(supabase: SupabaseClient): Promise<string | null> {
  const configError = configureNativeGoogleSignIn()
  if (configError) return configError

  try {
    if (Platform.OS === "android") {
      await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
    }

    const response = await GoogleSignin.signIn()
    if (!isSuccessResponse(response)) return null

    let idToken = response.data.idToken
    let accessToken: string | undefined
    if (!idToken) {
      const tokens = await GoogleSignin.getTokens()
      idToken = tokens.idToken
      accessToken = tokens.accessToken
    } else {
      try {
        accessToken = (await GoogleSignin.getTokens()).accessToken
      } catch {
        accessToken = undefined
      }
    }

    if (!idToken) return "Google did not return a sign-in token."

    const { error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
      access_token: accessToken,
    })
    return error?.message ?? null
  } catch (error) {
    if (isErrorWithCode(error)) {
      if (error.code === statusCodes.SIGN_IN_CANCELLED) return null
      if (error.code === statusCodes.IN_PROGRESS) return "Google sign-in is already in progress."
      if (error.code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
        return "Google Play Services is not available on this device."
      }
    }
    return error instanceof Error ? error.message : "Google sign-in failed."
  }
}

async function signInWithGoogleOAuthWeb(supabase: SupabaseClient): Promise<string | null> {
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

  try {
    const WebBrowser = await import("expo-web-browser")
    WebBrowser.maybeCompleteAuthSession()
    const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo)
    if (result.type === "success") return finishOAuthReturnUrl(supabase, result.url)
    if (result.type === "cancel" || result.type === "dismiss") return null
    return "Google sign-in did not complete."
  } catch {
    return "Google sign-in is not available in this browser."
  }
}

/**
 * iOS/Android: native Google account picker + Supabase `signInWithIdToken`.
 * Web: in-app auth session (no separate Google SDK).
 */
export async function signInWithGoogleNative(supabase: SupabaseClient): Promise<string | null> {
  if (Platform.OS === "web") {
    return signInWithGoogleOAuthWeb(supabase)
  }
  if (!nativeGoogleSignInEnabled()) {
    return "Google sign-in needs EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID and EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID, then a new dev client build."
  }
  return signInWithGoogleNativeSdk(supabase)
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
  if (Platform.OS === "web" || !nativeGoogleSignInEnabled()) return
  try {
    configureNativeGoogleSignIn()
    await GoogleSignin.signOut()
  } catch {
    // No native Google session, or module unavailable.
  }
}
