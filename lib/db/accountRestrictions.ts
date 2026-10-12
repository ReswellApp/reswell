import type { SupabaseClient } from "@supabase/supabase-js"

export type UserRestrictionState = {
  isAdmin: boolean
  isEmployee: boolean
  createdAt: string | null
  accountRestrictedUntil: string | null
  accountRestrictedReason: string | null
  messageRateLimitedUntil: string | null
}

export type SenderNewAccountFraudBanProfile = {
  createdAt: string | null
  isAdmin: boolean
  isEmployee: boolean
  accountRestrictedUntil: string | null
}

export async function fetchUserRestrictionState(
  supabase: SupabaseClient,
  userId: string,
): Promise<UserRestrictionState | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select(
      "is_admin, is_employee, created_at, account_restricted_until, account_restricted_reason, message_rate_limited_until",
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
    createdAt: typeof data.created_at === "string" ? data.created_at : null,
    accountRestrictedUntil:
      typeof data.account_restricted_until === "string" ? data.account_restricted_until : null,
    accountRestrictedReason:
      typeof data.account_restricted_reason === "string" ? data.account_restricted_reason : null,
    messageRateLimitedUntil:
      typeof data.message_rate_limited_until === "string" ? data.message_rate_limited_until : null,
  }
}

export async function fetchSenderNewAccountFraudBanProfile(
  supabase: SupabaseClient,
  userId: string,
): Promise<SenderNewAccountFraudBanProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("created_at, is_admin, is_employee, account_restricted_until")
    .eq("id", userId)
    .maybeSingle()

  if (error || !data) {
    console.error("[fetchSenderNewAccountFraudBanProfile]", error?.message ?? "profile missing")
    return null
  }

  return {
    createdAt: typeof data.created_at === "string" ? data.created_at : null,
    isAdmin: data.is_admin === true,
    isEmployee: data.is_employee === true,
    accountRestrictedUntil:
      typeof data.account_restricted_until === "string" ? data.account_restricted_until : null,
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
  const ids = await listDistinctMessageRecipientIdsSince(supabase, senderId, sinceIso)
  return ids == null ? null : ids.length
}

/** Other-party profile ids this sender delivered a DM to in the window. */
export async function listDistinctMessageRecipientIdsSince(
  supabase: SupabaseClient,
  senderId: string,
  sinceIso: string,
): Promise<string[] | null> {
  const { data: rows, error } = await supabase
    .from("messages")
    .select("conversation_id")
    .eq("sender_id", senderId)
    .gte("created_at", sinceIso)

  if (error) {
    console.error("[listDistinctMessageRecipientIdsSince]", error.message)
    return null
  }

  const conversationIds = [
    ...new Set(
      (rows ?? [])
        .map((row) => row.conversation_id)
        .filter((id): id is string => typeof id === "string" && id.length > 0),
    ),
  ]
  if (conversationIds.length === 0) return []

  const { data: conversations, error: convErr } = await supabase
    .from("conversations")
    .select("buyer_id, seller_id")
    .in("id", conversationIds)

  if (convErr) {
    console.error("[listDistinctMessageRecipientIdsSince] conversations:", convErr.message)
    return null
  }

  const ids = new Set<string>()
  for (const conversation of conversations ?? []) {
    if (conversation.buyer_id === senderId && typeof conversation.seller_id === "string") {
      ids.add(conversation.seller_id)
    } else if (conversation.seller_id === senderId && typeof conversation.buyer_id === "string") {
      ids.add(conversation.buyer_id)
    }
  }
  return [...ids]
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
