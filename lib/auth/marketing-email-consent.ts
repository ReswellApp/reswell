import type { User } from "@supabase/supabase-js"

/** Query param on `/auth/callback` and sign-up handoff URLs. */
export const MARKETING_OPT_IN_PARAM = "marketing"

export function parseMarketingOptInParam(
  value: string | null | undefined,
): boolean | null {
  if (value === "1" || value === "true") return true
  if (value === "0" || value === "false") return false
  return null
}

export function marketingOptInParamValue(optIn: boolean): string {
  return optIn ? "1" : "0"
}

/** Reads explicit signup marketing consent from Auth user metadata. */
export function userMarketingOptInFromMetadata(user: User): boolean | null {
  const meta = user.user_metadata as Record<string, unknown> | undefined
  if (typeof meta?.marketing_opt_in === "boolean") {
    return meta.marketing_opt_in
  }
  return null
}

/**
 * Whether the user opted in to marketing email at signup.
 * Defaults to false when consent was never captured (compliant default).
 */
export function userWantsMarketingEmails(user: User): boolean {
  return userMarketingOptInFromMetadata(user) === true
}
