import { isTransientAuthNetworkError } from "@/lib/auth/clear-supabase-auth-cookies"
import { isRecoverableOAuthCodeExchangeError } from "@/lib/auth/is-recoverable-oauth-code-exchange-error"
import type { SupabaseClient } from "@supabase/supabase-js"

/** Exchange a PKCE auth code with transient-network retries (OAuth + password recovery). */
export async function exchangeAuthCodeWithRetry(
  supabase: SupabaseClient,
  code: string,
): Promise<
  Awaited<ReturnType<SupabaseClient["auth"]["exchangeCodeForSession"]>>
> {
  const maxAttempts = 5

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const result = await supabase.auth.exchangeCodeForSession(code)
    if (!result.error) return result
    if (isRecoverableOAuthCodeExchangeError(result.error)) {
      return result
    }
    if (
      isTransientAuthNetworkError(result.error) &&
      attempt < maxAttempts - 1
    ) {
      await new Promise((r) => setTimeout(r, 200 * (attempt + 1)))
      continue
    }
    return result
  }

  return supabase.auth.exchangeCodeForSession(code)
}
