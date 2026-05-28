import type { User } from "@supabase/supabase-js"

/** Max gap between account creation and first sign-in (same OAuth session). */
const FIRST_SIGN_IN_MAX_DELTA_MS = 3 * 60 * 1000

/** Fallback when `last_sign_in_at` is missing on a brand-new JWT. */
const RECENT_ACCOUNT_MAX_AGE_MS = 15 * 60 * 1000

/**
 * True when this OAuth session is the user's first sign-in (no pre-existing Reswell account).
 * Returning Google users have an old `created_at` and a fresh `last_sign_in_at`.
 */
export function isNewOAuthAccount(user: User): boolean {
  const createdMs = new Date(user.created_at).getTime()
  if (!Number.isFinite(createdMs)) return false

  const lastSignInRaw = user.last_sign_in_at?.trim()
  if (lastSignInRaw) {
    const lastSignInMs = new Date(lastSignInRaw).getTime()
    if (Number.isFinite(lastSignInMs)) {
      if (Math.abs(lastSignInMs - createdMs) <= FIRST_SIGN_IN_MAX_DELTA_MS) {
        return true
      }
      return false
    }
  }

  return Date.now() - createdMs < RECENT_ACCOUNT_MAX_AGE_MS
}
