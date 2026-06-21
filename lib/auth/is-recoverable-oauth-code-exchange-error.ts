import { isTransientAuthNetworkError } from "@/lib/auth/clear-supabase-auth-cookies"

/**
 * OAuth code exchange can fail while the session is still valid — double callback hits,
 * mobile Safari replaying the return URL, or PKCE cookies from the winning request landing
 * after this handler's first attempt. Poll `getUser()` instead of sending users to an error page.
 */
export function isRecoverableOAuthCodeExchangeError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false
  if (isTransientAuthNetworkError(error)) return true

  const code = (error as { code?: unknown }).code
  const message = String((error as { message?: unknown }).message ?? "").toLowerCase()

  if (code === "invalid_grant" || code === "bad_oauth_state") return true
  if (message.includes("invalid grant")) return true
  if (message.includes("code verifier") || message.includes("code challenge")) return true
  if (message.includes("authorization code")) return true
  if (message.includes("already been used") || message.includes("already used")) return true

  return false
}
