import type { SupabaseClient } from "@supabase/supabase-js"

export type UserRestrictionState = {
  isAdmin: boolean
  isEmployee: boolean
  accountRestrictedUntil: string | null
  accountRestrictedReason: string | null
  messageRateLimitedUntil: string | null
}

export async function fetchUserRestrictionState(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserRestrictionState | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "is_admin, is_employee, account_restricted_until, account_restricted_reason, message_rate_limited_until",
    )
    .eq("id", userId)
    .maybeSingle()

  if (error || !data) {
    console.error("[fetchUserRestrictionState]", error?.message ?? "profile missing")
    return null
  }

  return {
    isAdmin: data.is_admin === true,
    isEmployee: data.is_employee === true,
    accountRestrictedUntil:
      typeof data.account_restricted_until === "string" ? data.account_restricted_until : null,
    accountRestrictedReason:
      typeof data.account_restricted_reason === "string" ? data.account_restricted_reason : null,
    messageRateLimitedUntil:
      typeof data.message_rate_limited_until === "string" ? data.message_rate_limited_until : null,
  }
}

export async function setMessageRateLimitedUntil(
  supabase: SupabaseClient,
  userId: string,
  untilIso: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("profiles")
    .update({
      message_rate_limited_until: untilIso,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)

  if (error) {
    console.error("[setMessageRateLimitedUntil]", error.message)
    return false
  }

  return true
}

export async function setAccountRestrictionForUser(
  supabase: SupabaseClient,
  userId: string,
  input: {
    restrictedUntil: string | null
    reason: string | null
  },
): Promise<boolean> {
  const { error } = await supabase
    .from("profiles")
    .update({
      account_restricted_until: input.restrictedUntil,
      account_restricted_reason: input.reason,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId)

  if (error) {
    console.error("[setAccountRestrictionForUser]", error.message)
    return false
  }

  return true
}

export async function countDistinctMessageRecipientsSince(
  supabase: SupabaseClient,
  senderId: string,
  sinceIso: string,
): Promise<number | null> {
  const { data, error } = await supabase.rpc("count_distinct_dm_recipients_since", {
    p_sender_id: senderId,
    p_since: sinceIso,
  })

  if (error) {
    console.error("[countDistinctMessageRecipientsSince]", error.message)
    return null
  }

  const n = typeof data === "number" ? data : Number(data)
  return Number.isFinite(n) ? n : 0
}

export async function senderMessagedRecipientSince(
  supabase: SupabaseClient,
  senderId: string,
  recipientId: string,
  sinceIso: string,
): Promise<boolean | null> {
  const { data, error } = await supabase.rpc("sender_messaged_recipient_since", {
    p_sender_id: senderId,
    p_recipient_id: recipientId,
    p_since: sinceIso,
  })

  if (error) {
    console.error("[senderMessagedRecipientSince]", error.message)
    return null
  }

  return data === true
}
