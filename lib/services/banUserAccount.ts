import type { SupabaseClient } from "@supabase/supabase-js"
import {
  fetchUserRestrictionState,
  setAccountRestrictionForUser,
} from "@/lib/db/accountRestrictions"
import {
  PERMANENT_ACCOUNT_RESTRICTED_UNTIL,
  PERMANENT_AUTH_BAN_DURATION,
  isUserAuthBanned,
} from "@/lib/messages/account-ban-errors"
import { applyAdminSellerBan } from "@/lib/services/sellerBan"
import { createServiceRoleClient } from "@/lib/supabase/server"

export {
  PERMANENT_ACCOUNT_RESTRICTED_UNTIL,
  PERMANENT_AUTH_BAN_DURATION,
  isUserAuthBanned,
} from "@/lib/messages/account-ban-errors"

export type BanUserAccountResult =
  | { ok: true; userId: string }
  | { ok: false; userId: string; error: string }

export type AdminAccountBanState = {
  banned: boolean
  bannedUntil: string | null
  reason: string | null
}

export type AdminAccountBanResult =
  | {
      ok: true
      banned: boolean
      bannedUntil: string | null
      reason: string | null
      affectedListingIds: string[]
      restrictedUntil: string | null
      sellerBannedAt: string | null
      sellerBannedReason: string | null
    }
  | { ok: false; error: string }

async function getServiceClient(): Promise<
  | { ok: true; service: ReturnType<typeof createServiceRoleClient> }
  | { ok: false; error: string }
> {
  try {
    return { ok: true, service: createServiceRoleClient() }
  } catch {
    return { ok: false, error: "Server configuration error." }
  }
}

async function setAuthBanForUser(
  supabase: SupabaseClient,
  userId: string,
  banned: boolean,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error: lookupError } = await supabase.auth.admin.getUserById(userId)
  if (lookupError) {
    return { ok: false, error: lookupError.message }
  }
  if (!data.user) {
    return { ok: false, error: "User not found." }
  }

  const existingMeta =
    data.user.app_metadata && typeof data.user.app_metadata === "object"
      ? { ...data.user.app_metadata }
      : {}

  const { error } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: banned ? PERMANENT_AUTH_BAN_DURATION : "none",
    app_metadata: { ...existingMeta, banned },
  })
  if (error) {
    return { ok: false, error: error.message }
  }
  return { ok: true }
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

  const bannedAuth = await setAuthBanForUser(supabase, trimmedId, true)
  if (!bannedAuth.ok) {
    return { ok: false, userId: trimmedId, error: bannedAuth.error }
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

export async function unbanUserAccount(
  supabase: SupabaseClient,
  userId: string,
): Promise<BanUserAccountResult> {
  const trimmedId = userId.trim()
  if (!trimmedId) {
    return { ok: false, userId: trimmedId, error: "Missing user id." }
  }

  const clearedAuth = await setAuthBanForUser(supabase, trimmedId, false)
  if (!clearedAuth.ok) {
    return { ok: false, userId: trimmedId, error: clearedAuth.error }
  }

  const restrictionOk = await setAccountRestrictionForUser(supabase, trimmedId, {
    restrictedUntil: null,
    reason: null,
  })
  if (!restrictionOk) {
    return {
      ok: false,
      userId: trimmedId,
      error: "Auth ban removed but profile restriction could not be cleared.",
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

export async function loadAdminAccountBan(userId: string): Promise<
  | { ok: true; state: AdminAccountBanState }
  | { ok: false; error: string }
> {
  const client = await getServiceClient()
  if (!client.ok) return client

  const { data, error } = await client.service.auth.admin.getUserById(userId)
  if (error) {
    console.error("[loadAdminAccountBan] auth lookup:", error.message)
    return { ok: false, error: "Could not load user." }
  }
  if (!data.user) {
    return { ok: false, error: "User not found." }
  }

  const restriction = await fetchUserRestrictionState(client.service, userId)
  const bannedUntil = data.user.banned_until ?? null

  return {
    ok: true,
    state: {
      banned: isUserAuthBanned(data.user),
      bannedUntil,
      reason: restriction?.accountRestrictedReason ?? null,
    },
  }
}

export async function applyAdminAccountBan(input: {
  userId: string
  banned: boolean
  reason: string | null
  actorUserId?: string | null
}): Promise<AdminAccountBanResult> {
  const client = await getServiceClient()
  if (!client.ok) return client
  const service = client.service
  const note = input.reason?.trim() || null

  if (input.banned) {
    const banned = await banUserAccount(service, input.userId, note ?? "")
    if (!banned.ok) {
      return { ok: false, error: banned.error }
    }

    const seller = await applyAdminSellerBan({
      userId: input.userId,
      banned: true,
      reason: note,
      actorUserId: input.actorUserId,
    })
    if (!seller.ok) {
      return {
        ok: false,
        error: `Account banned, but listings could not be updated: ${seller.error}`,
      }
    }

    try {
      await service.auth.admin.signOut(input.userId, "global")
    } catch {
      // Auth ban already blocks new sessions; leftover tokens expire.
    }

    const { data } = await service.auth.admin.getUserById(input.userId)

    return {
      ok: true,
      banned: true,
      bannedUntil: data.user?.banned_until ?? null,
      reason: note,
      affectedListingIds: seller.affectedListingIds,
      restrictedUntil: PERMANENT_ACCOUNT_RESTRICTED_UNTIL,
      sellerBannedAt: seller.sellerBannedAt,
      sellerBannedReason: seller.sellerBannedReason,
    }
  }

  const cleared = await unbanUserAccount(service, input.userId)
  if (!cleared.ok) {
    return { ok: false, error: cleared.error }
  }

  const seller = await applyAdminSellerBan({
    userId: input.userId,
    banned: false,
    reason: null,
    actorUserId: input.actorUserId,
  })
  if (!seller.ok) {
    return {
      ok: false,
      error: `Account ban removed, but listings could not be restored: ${seller.error}`,
    }
  }

  return {
    ok: true,
    banned: false,
    bannedUntil: null,
    reason: null,
    affectedListingIds: seller.affectedListingIds,
    restrictedUntil: null,
    sellerBannedAt: null,
    sellerBannedReason: null,
  }
}
