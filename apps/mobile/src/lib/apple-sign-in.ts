import type { SupabaseClient } from "@supabase/supabase-js"
import * as AppleAuthentication from "expo-apple-authentication"
import {
  CryptoDigestAlgorithm,
  digestStringAsync,
  randomUUID,
} from "expo-crypto"
import { Platform } from "react-native"

export type AppleIdCredential = {
  idToken: string
  /** Raw nonce. Supabase compares its hash to the ID token claim. */
  nonce: string
}

export type AppleCredentialResult =
  | { ok: true; credential: AppleIdCredential }
  | { ok: false; message: string | null }

export async function appleSignInAvailable(): Promise<boolean> {
  if (Platform.OS !== "ios") return false
  try {
    return await AppleAuthentication.isAvailableAsync()
  } catch {
    return false
  }
}

/** Native Sign in with Apple. `message` is null when the person cancels. */
export async function obtainAppleIdCredential(): Promise<AppleCredentialResult> {
  if (Platform.OS !== "ios") {
    return { ok: false, message: "Sign in with Apple is only available on iPhone." }
  }

  const available = await appleSignInAvailable()
  if (!available) {
    return { ok: false, message: "Sign in with Apple is not available on this device." }
  }

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
    if (!credential.identityToken) {
      return { ok: false, message: "Apple did not return a sign-in token." }
    }
    return {
      ok: true,
      credential: {
        idToken: credential.identityToken,
        nonce: rawNonce,
      },
    }
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      (error as { code?: string }).code === "ERR_REQUEST_CANCELED"
    ) {
      return { ok: false, message: null }
    }
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Apple sign-in failed.",
    }
  }
}

export async function signInWithAppleNative(supabase: SupabaseClient): Promise<string | null> {
  const result = await obtainAppleIdCredential()
  if (!result.ok) return result.message

  const { error } = await supabase.auth.signInWithIdToken({
    provider: "apple",
    token: result.credential.idToken,
    nonce: result.credential.nonce,
  })
  return error?.message ?? null
}
