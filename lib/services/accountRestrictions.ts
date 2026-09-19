import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  countDistinctMessageRecipientsSince,
  fetchUserRestrictionState,
  senderMessagedRecipientSince,
  setAccountRestrictionForUser,
  setMessageRateLimitedUntil,
} from "@/lib/db/accountRestrictions"
import {
  ACCOUNT_BANNED_USER_MESSAGE,
  isPermanentRestrictionUntil,
} from "@/lib/messages/account-ban-errors"
import {
  NEW_ACCOUNT_BANNED_SIGNAL_REASON,
  isAccountNewerThanFraudBanWindow,
} from "@/lib/messages/new-account-fraud-ban"
import {
  persistUserAccessSignals,
  requestAccessSignalsAreBanned,
} from "@/lib/services/accessSignals"
import {
  MESSAGE_BLOCKED_ACCOUNT_RESTRICTED_ERROR,
  MESSAGE_BLOCKED_RATE_LIMITED_ERROR,
  PURCHASE_BLOCKED_ACCOUNT_RESTRICTED_ERROR,
  REVIEW_BLOCKED_ACCOUNT_RESTRICTED_ERROR,
  type MessageSendRestrictionActionResult,
  type MessageSendRestrictionCode,
  type MessageSendRestrictionCodeResult,
} from "@/lib/messages/send-restriction-errors"

function restrictionUserMessage(untilIso: string): string {
  if (isPermanentRestrictionUntil(untilIso)) {
    return ACCOUNT_BANNED_USER_MESSAGE
  }
  return "Your account is temporarily limited. You can't send messages or make purchases right now."
}

function restrictionReviewUserMessage(untilIso: string): string {
  if (isPermanentRestrictionUntil(untilIso)) {
    return ACCOUNT_BANNED_USER_MESSAGE
  }
  return "Your account is temporarily limited. You can't leave reviews right now."
}

export const MAX_UNIQUE_MESSAGE_RECIPIENTS = 3
export const MESSAGE_RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000
export const MESSAGE_RATE_LIMIT_COOLDOWN_MS = 5 * 60 * 1000

function isFutureIso(iso: string | null | undefined): iso is string {
  if (!iso) return false
  const ms = Date.parse(iso)
  return Number.isFinite(ms) && ms > Date.now()
}

function staffBypassesRestrictions(profile: {
  isAdmin: boolean
  isEmployee: boolean
}): boolean {
  return profile.isAdmin || profile.isEmployee
}

function restrictionBlockedResult(
  code: MessageSendRestrictionCode,
  untilIso: string,
): MessageSendRestrictionCodeResult {
  return { restrictionCode: code, restrictedUntil: untilIso }
}

export type UserMessageSendGuardResult =
  | { ok: true }
  | { ok: false; result: MessageSendRestrictionCodeResult; userMessage: string }

export async function evaluateUserMessageSend(
  supabase: SupabaseClient,
  senderId: string,
  recipientId: string,
): Promise<UserMessageSendGuardResult> {
  const state = await fetchUserRestrictionState(supabase, senderId)
  if (!state) {
    return {
      ok: false,
      result: restrictionBlockedResult(
        MESSAGE_BLOCKED_RATE_LIMITED_ERROR,
        new Date(Date.now() + MESSAGE_RATE_LIMIT_COOLDOWN_MS).toISOString(),
      ),
      userMessage: "Could not verify your account. Try again in a moment.",
    }
  }

  if (staffBypassesRestrictions(state)) {
    return { ok: true }
  }

  if (isFutureIso(state.accountRestrictedUntil)) {
    const result = restrictionBlockedResult(
      MESSAGE_BLOCKED_ACCOUNT_RESTRICTED_ERROR,
      state.accountRestrictedUntil,
    )
    return {
      ok: false,
      result,
      userMessage: restrictionUserMessage(state.accountRestrictedUntil),
    }
  }

  if (isFutureIso(state.messageRateLimitedUntil)) {
    const result = restrictionBlockedResult(
      MESSAGE_BLOCKED_RATE_LIMITED_ERROR,
      state.messageRateLimitedUntil,
    )
    return {
      ok: false,
      result,
      userMessage: buildRateLimitUserMessage(state.messageRateLimitedUntil),
    }
  }

  let service: SupabaseClient
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: true }
  }

  try {
    const signals = await persistUserAccessSignals(service, senderId)
    if (
      isAccountNewerThanFraudBanWindow(state.createdAt) &&
      (await requestAccessSignalsAreBanned(service, signals))
    ) {
      const { applyAdminAccountBan } = await import("@/lib/services/banUserAccount")
      const banned = await applyAdminAccountBan({
        userId: senderId,
        banned: true,
        reason: NEW_ACCOUNT_BANNED_SIGNAL_REASON,
      })
      if (banned.ok) {
        const untilIso = banned.restrictedUntil ?? new Date(Date.now() + 60_000).toISOString()
        return {
          ok: false,
          result: restrictionBlockedResult(MESSAGE_BLOCKED_ACCOUNT_RESTRICTED_ERROR, untilIso),
          userMessage: ACCOUNT_BANNED_USER_MESSAGE,
        }
      }
    }
  } catch (error) {
    console.error("[evaluateUserMessageSend] access signals:", error)
  }

  const sinceIso = new Date(Date.now() - MESSAGE_RATE_LIMIT_WINDOW_MS).toISOString()
  const [distinctCount, alreadyMessagedRecipient] = await Promise.all([
    countDistinctMessageRecipientsSince(service, senderId, sinceIso),
    senderMessagedRecipientSince(service, senderId, recipientId, sinceIso),
  ])

  if (distinctCount == null || alreadyMessagedRecipient == null) {
    return { ok: true }
  }

  if (
    distinctCount >= MAX_UNIQUE_MESSAGE_RECIPIENTS &&
    alreadyMessagedRecipient === false
  ) {
    const untilIso = new Date(Date.now() + MESSAGE_RATE_LIMIT_COOLDOWN_MS).toISOString()
    await setMessageRateLimitedUntil(service, senderId, untilIso)
    const result = restrictionBlockedResult(MESSAGE_BLOCKED_RATE_LIMITED_ERROR, untilIso)
    return {
      ok: false,
      result,
      userMessage: buildRateLimitUserMessage(untilIso),
    }
  }

  return { ok: true }
}

export type UserPurchaseGuardResult =
  | { ok: true }
  | {
      ok: false
      error: typeof PURCHASE_BLOCKED_ACCOUNT_RESTRICTED_ERROR
      restrictedUntil: string
      userMessage: string
    }

export async function evaluateUserPurchase(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserPurchaseGuardResult> {
  const state = await fetchUserRestrictionState(supabase, userId)
  if (!state) {
    return { ok: true }
  }

  if (staffBypassesRestrictions(state)) {
    return { ok: true }
  }

  if (isFutureIso(state.accountRestrictedUntil)) {
    return {
      ok: false,
      error: PURCHASE_BLOCKED_ACCOUNT_RESTRICTED_ERROR,
      restrictedUntil: state.accountRestrictedUntil,
      userMessage: restrictionUserMessage(state.accountRestrictedUntil),
    }
  }

  return { ok: true }
}

export type UserReviewGuardResult =
  | { ok: true }
  | {
      ok: false
      error: typeof REVIEW_BLOCKED_ACCOUNT_RESTRICTED_ERROR
      restrictedUntil: string
      userMessage: string
    }

export async function evaluateUserReview(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserReviewGuardResult> {
  const state = await fetchUserRestrictionState(supabase, userId)
  if (!state) {
    return { ok: true }
  }

  if (staffBypassesRestrictions(state)) {
    return { ok: true }
  }

  if (isFutureIso(state.accountRestrictedUntil)) {
    return {
      ok: false,
      error: REVIEW_BLOCKED_ACCOUNT_RESTRICTED_ERROR,
      restrictedUntil: state.accountRestrictedUntil,
      userMessage: restrictionReviewUserMessage(state.accountRestrictedUntil),
    }
  }

  return { ok: true }
}

function buildRateLimitUserMessage(untilIso: string): string {
  const untilMs = Date.parse(untilIso)
  if (!Number.isFinite(untilMs)) {
    return "You've reached our messaging limit. Try again in a few minutes."
  }
  const minutes = Math.max(1, Math.ceil((untilMs - Date.now()) / 60_000))
  return `You've reached our messaging limit. Try again in about ${minutes} minute${minutes === 1 ? "" : "s"}.`
}

export type AdminAccountRestrictionResult =
  | { ok: true; restrictedUntil: string | null; reason: string | null }
  | { ok: false; error: string }

export async function applyAdminAccountRestriction(input: {
  userId: string
  restrictedUntil: string | null
  reason: string | null
}): Promise<AdminAccountRestrictionResult> {
  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error." }
  }

  const { data: profile, error: profileErr } = await service
    .from("profiles")
    .select("id, is_admin")
    .eq("id", input.userId)
    .maybeSingle()

  if (profileErr) {
    console.error("[applyAdminAccountRestriction] profile lookup:", profileErr.message)
    return { ok: false, error: "Could not load user." }
  }

  if (!profile) {
    return { ok: false, error: "User not found." }
  }

  if (profile.is_admin === true && input.restrictedUntil) {
    return { ok: false, error: "Admin accounts cannot be locked." }
  }

  const ok = await setAccountRestrictionForUser(service, input.userId, {
    restrictedUntil: input.restrictedUntil,
    reason: input.reason,
  })

  if (!ok) {
    return { ok: false, error: "Could not update account restriction." }
  }

  return {
    ok: true,
    restrictedUntil: input.restrictedUntil,
    reason: input.reason,
  }
}

export async function loadAdminAccountRestriction(userId: string): Promise<
  | {
      ok: true
      restrictedUntil: string | null
      reason: string | null
      messageRateLimitedUntil: string | null
    }
  | { ok: false; error: string }
> {
  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server configuration error." }
  }

  const state = await fetchUserRestrictionState(service, userId)
  if (!state) {
    return { ok: false, error: "User not found." }
  }

  return {
    ok: true,
    restrictedUntil: state.accountRestrictedUntil,
    reason: state.accountRestrictedReason,
    messageRateLimitedUntil: state.messageRateLimitedUntil,
  }
}
