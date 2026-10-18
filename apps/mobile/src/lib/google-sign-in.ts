import type { SupabaseClient } from "@supabase/supabase-js"
import { Platform } from "react-native"
import { publicGoogleIosClientId, publicGoogleWebClientId } from "@/lib/public-env"

/**
 * Native Google account picker. The ID token is exchanged for the same
 * Supabase session the website uses.
 *
 * iOS Google Sign-In puts a nonce in that token and this SDK does not return
 * the raw value. Supabase must have Skip nonce checks enabled for Google.
 */
export async function signInWithGoogleNative(supabase: SupabaseClient): Promise<string | null> {
  if (Platform.OS === "web") {
    return "Continue with Google is available in the iOS and Android app."
  }

  const webClientId = publicGoogleWebClientId()
  if (!webClientId) {
    return "Add EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID to .env.local, then rebuild the app."
  }
  const iosClientId = publicGoogleIosClientId()
  if (Platform.OS === "ios" && !iosClientId) {
    return "Add EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID to .env.local, then rebuild the app."
  }

  try {
    const { GoogleSignin, isSuccessResponse, statusCodes } = await import(
      "@react-native-google-signin/google-signin"
    )
    GoogleSignin.configure(iosClientId ? { webClientId, iosClientId } : { webClientId })
    await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true })
    const response = await GoogleSignin.signIn()
    if (!isSuccessResponse(response)) return null
    const idToken = response.data.idToken
    if (!idToken) return "Google did not return a sign-in token."
    const { error } = await supabase.auth.signInWithIdToken({
      provider: "google",
      token: idToken,
    })
    return error?.message ?? null
  } catch (error) {
    const message = await googleSignInErrorMessage(error)
    return message || null
  }
}

export async function signOutGoogleNative(): Promise<void> {
  if (Platform.OS === "web") return
  try {
    const { GoogleSignin } = await import("@react-native-google-signin/google-signin")
    await GoogleSignin.signOut()
  } catch {
    // No Google session, or this build does not include the native module yet.
  }
}

async function googleSignInErrorMessage(error: unknown): Promise<string> {
  const { statusCodes } = await import("@react-native-google-signin/google-signin")
  const code = errorCode(error)
  if (code === statusCodes.SIGN_IN_CANCELLED) return ""
  if (code === statusCodes.IN_PROGRESS) return "Google sign-in is already in progress."
  if (code === statusCodes.PLAY_SERVICES_NOT_AVAILABLE) {
    return "Google Play services are unavailable on this device."
  }
  const message = error instanceof Error ? error.message : ""
  if (
    message.includes("RNGoogleSignin") ||
    message.includes("could not be found") ||
    message.includes("TurboModuleRegistry")
  ) {
    return "Google sign-in needs a new development build."
  }
  return message || "Google sign-in failed."
}

function errorCode(error: unknown): string | null {
  if (!error || typeof error !== "object" || !("code" in error)) return null
  return typeof error.code === "string" ? error.code : null
}
