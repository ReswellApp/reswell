export const ACCOUNT_BANNED_ERROR = "account_banned" as const

export const ACCOUNT_BANNED_USER_MESSAGE =
  "We're sorry, but this account did not meet the standards we require to keep Reswell a safe place to buy and sell boards."

/** ~100 years — Supabase auth permanent ban via `ban_duration`. */
export const PERMANENT_AUTH_BAN_DURATION = "876000h" as const

export const PERMANENT_ACCOUNT_RESTRICTED_UNTIL = "2099-12-31T23:59:59.999Z"

export function isPermanentRestrictionUntil(iso: string | null | undefined): boolean {
  if (!iso) return false
  if (iso === PERMANENT_ACCOUNT_RESTRICTED_UNTIL) return true
  const ms = Date.parse(iso)
  const permanentMs = Date.parse(PERMANENT_ACCOUNT_RESTRICTED_UNTIL)
  return Number.isFinite(ms) && Number.isFinite(permanentMs) && ms >= permanentMs
}

export function isUserAuthBanned(
  user:
    | {
        banned_until?: string | null
        app_metadata?: { banned?: unknown } | null
      }
    | null
    | undefined,
): boolean {
  if (user?.app_metadata?.banned === true) return true
  if (!user?.banned_until) return false
  const bannedUntilMs = Date.parse(user.banned_until)
  return Number.isFinite(bannedUntilMs) && bannedUntilMs > Date.now()
}
