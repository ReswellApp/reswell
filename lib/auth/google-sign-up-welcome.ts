import type { User } from "@supabase/supabase-js"

import {
  hasCompletedProfileUsername,
  isGoogleAuthUser,
  isRecentOAuthSignup,
} from "@/lib/auth/profile-completion"

/** Set on OAuth callback so the welcome page can render before profile data exists. */
export const GOOGLE_NEW_SIGNUP_COOKIE = "rw_google_new_signup"

/** Set in sessionStorage after the user clicks through the welcome page. */
export const GOOGLE_NEW_SIGNUP_WELCOME_COMPLETED_KEY = "rw_google_welcome_completed"

/**
 * One-shot guard: the client safety net redirects to the welcome page at most once per
 * session. Without it, a host/cookie hiccup where the client sees a session but the server
 * does not can ping-pong welcome ⇄ login until the browser bails with "This page couldn't load".
 */
export const GOOGLE_NEW_SIGNUP_WELCOME_REDIRECT_ATTEMPTED_KEY =
  "rw_google_welcome_redirect_attempted"

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

/**
 * True when a Google user should see `/auth/google-sign-up-success` (new sign-up, not a return visit).
 * Aligns with the username-setup modal: recent Google account without a chosen username yet.
 */
export function shouldShowGoogleSignUpWelcome(user: User): boolean {
  if (!isGoogleAuthUser(user)) return false
  if (isNewOAuthAccount(user)) return true
  if (isRecentOAuthSignup(user) && !hasCompletedProfileUsername(user)) {
    return true
  }
  return false
}
