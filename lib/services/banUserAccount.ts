import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchUserRestrictionState,
  setAccountRestrictionForUser,
} from "@/lib/db/accountRestrictions"

/** ~100 years — Supabase auth permanent ban via `ban_duration`. */
export const PERMANENT_AUTH_BAN_DURATION = "876000h" as const

export const PERMANENT_ACCOUNT_RESTRICTED_UNTIL = "2099-12-31T23:59:59.999Z"

export type BanUserAccountResult =
  | { ok: true; userId: string }
  | { ok: false; userId: string; error: string }

export function isUserAuthBanned(user: { banned_until?: string | null } | null | undefined): boolean {
  if (!user?.banned_until) return false
  const bannedUntilMs = Date.parse(user.banned_until)
  return Number.isFinite(bannedUntilMs) && bannedUntilMs > Date.now()
}

export async function banUserAccount(
  supabase: SupabaseClient,
  userId: string,
  reason: string,
): Promise<BanUserAccountResult> {
  const trimmedId = userId.trim()
  if (!trimmedId) {
    return { ok: false, userId: trimmedId, error: "Missing user id." }
  }

  const state = await fetchUserRestrictionState(supabase, trimmedId)
  if (!state) {
    return { ok: false, userId: trimmedId, error: "User not found." }
  }
  if (state.isAdmin) {
    return { ok: false, userId: trimmedId, error: "Admin accounts cannot be banned." }
  }

  const { error: banError } = await supabase.auth.admin.updateUserById(trimmedId, {
    ban_duration: PERMANENT_AUTH_BAN_DURATION,
  })
  if (banError) {
    return { ok: false, userId: trimmedId, error: banError.message }
  }

  const restrictionOk = await setAccountRestrictionForUser(supabase, trimmedId, {
    restrictedUntil: PERMANENT_ACCOUNT_RESTRICTED_UNTIL,
    reason: reason.trim() || null,
  })
  if (!restrictionOk) {
    return {
      ok: false,
      userId: trimmedId,
      error: "Auth ban applied but profile restriction could not be saved.",
    }
  }

  return { ok: true, userId: trimmedId }
}

export async function banUserAccounts(
  supabase: SupabaseClient,
  userIds: readonly string[],
  reason: string,
): Promise<{
  banned: string[]
  failed: Array<{ userId: string; error: string }>
}> {
  const banned: string[] = []
  const failed: Array<{ userId: string; error: string }> = []

  for (const userId of userIds) {
    const result = await banUserAccount(supabase, userId, reason)
    if (result.ok) {
      banned.push(result.userId)
    } else {
      failed.push({ userId: result.userId, error: result.error })
    }
  }

  return { banned, failed }
}
