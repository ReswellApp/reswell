import {
  isNonFatalGetUserError,
  isTransientAuthNetworkError,
} from "@/lib/auth/clear-supabase-auth-cookies"
import type { SupabaseClient, User } from "@supabase/supabase-js"

const DEFAULT_MAX_ATTEMPTS = 24
const DEFAULT_BASE_DELAY_MS = 100

function delayMs(attempt: number, baseDelayMs: number): number {
  return baseDelayMs * (attempt + 1)
}

/**
 * After a failed or raced OAuth code exchange, poll until Supabase SSR sees a user on the
 * request. Mobile Safari often needs several seconds for cookies from a parallel callback.
 */
export async function waitForUserAfterOAuthExchange(
  supabase: SupabaseClient,
  options?: {
    maxAttempts?: number
    baseDelayMs?: number
  },
): Promise<User | null> {
  const maxAttempts = options?.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  const baseDelayMs = options?.baseDelayMs ?? DEFAULT_BASE_DELAY_MS

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()
      if (!error && user) return user
      if (
        error &&
        !isNonFatalGetUserError(error) &&
        !isTransientAuthNetworkError(error)
      ) {
        return null
      }
    } catch (error) {
      if (
        !isTransientAuthNetworkError(error) &&
        attempt >= maxAttempts - 1
      ) {
        return null
      }
    }

    if (attempt < maxAttempts - 1) {
      await new Promise((r) => setTimeout(r, delayMs(attempt, baseDelayMs)))
    }
  }

  return null
}
