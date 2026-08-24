import type { User } from "@supabase/supabase-js"

/** Generous window for OAuth redirects / slow first paint when DB column is missing. */
export const GOOGLE_PROFILE_SETUP_WINDOW_MS = 30 * 60 * 1000

export const PROFILE_USERNAME_COMPLETED_METADATA_KEY = "profile_username_completed"

export function getOAuthAvatarUrl(user: User): string | null {
  const meta = user.user_metadata as Record<string, unknown> | undefined
  const fromMeta =
    (typeof meta?.avatar_url === "string" && meta.avatar_url.trim()) ||
    (typeof meta?.picture === "string" && meta.picture.trim()) ||
    ""
  return fromMeta || null
}

export function hasCompletedProfileUsername(user: User): boolean {
  const meta = user.user_metadata as Record<string, unknown> | undefined
  return meta?.[PROFILE_USERNAME_COMPLETED_METADATA_KEY] === true
}

export function isRecentOAuthSignup(user: User): boolean {
  const created = new Date(user.created_at).getTime()
  return Number.isFinite(created) && Date.now() - created < GOOGLE_PROFILE_SETUP_WINDOW_MS
}

export function isGoogleAuthUser(user: User): boolean {
  const am = user.app_metadata ?? {}
  const providers = am.providers
  if (Array.isArray(providers) && providers.some((p) => String(p).toLowerCase() === "google")) {
    return true
  }
  if (typeof am.provider === "string" && am.provider.toLowerCase() === "google") {
    return true
  }
  if (user.identities?.some((identity) => identity.provider === "google")) {
    return true
  }

  const meta = user.user_metadata as Record<string, unknown> | undefined
  const iss = typeof meta?.iss === "string" ? meta.iss : ""
  if (iss.includes("accounts.google.com")) return true

  return false
}

export const COMPLETE_PROFILE_PATH = "/auth/complete-profile"
