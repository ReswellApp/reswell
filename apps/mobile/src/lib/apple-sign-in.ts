import type { SupabaseClient } from "@supabase/supabase-js"
import { CryptoDigestAlgorithm, digestStringAsync, randomUUID } from "expo-crypto"
import { Platform } from "react-native"

/** iOS Sign in with Apple. Supabase compares a SHA-256 of the raw nonce to the token claim. */
export async function signInWithAppleNative(supabase: SupabaseClient): Promise<string | null> {
  if (Platform.OS !== "ios") return "Apple sign-in is only available on iPhone."
  const AppleAuthentication = await import("expo-apple-authentication")
  const available = await AppleAuthentication.isAvailableAsync()
  if (!available) return "Apple sign-in is not available on this device."

  const rawNonce = randomUUID()
  const hashedNonce = await digestStringAsync(CryptoDigestAlgorithm.SHA256, rawNonce)

  try {
    const credential = await AppleAuthentication.signInAsync({
      requestedScopes: [
        AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        AppleAuthentication.AppleAuthenticationScope.EMAIL,
      ],
      nonce: hashedNonce,
    })
    if (!credential.identityToken) return "Apple did not return a sign-in token."
    const { error } = await supabase.auth.signInWithIdToken({
      provider: "apple",
      token: credential.identityToken,
      nonce: rawNonce,
    })
    return error?.message ?? null
  } catch (error) {
    if (isAppleCancel(error)) return null
    return error instanceof Error ? error.message : "Apple sign-in failed."
  }
}

function isAppleCancel(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === "ERR_REQUEST_CANCELED"
  )
}
