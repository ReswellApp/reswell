import type { SupabaseClient } from "@supabase/supabase-js"
import type { MessagePolicyReasonCode } from "@/lib/messages/fraud-reason-codes"
import { getTrailingMessagesForConversation } from "@/lib/db/conversationTrailingMessages"
import { evaluateMessageSenderTrust } from "@/lib/services/messageSenderTrust"
import {
  detectExternalLinkPolicyViolation,
  detectMessagePolicyViolation,
} from "@/lib/utils/detect-message-policy-violation"
import {
  fragmentsCombineIntoPhoneNumber,
  messageIsPhoneNumberFragmentCandidate,
} from "@/lib/utils/detect-message-phone-fragments"

export type MessagePolicyStaffProfile = {
  is_admin: boolean | null
  is_employee: boolean | null
}

/** Staff accounts may send phone/email/off-platform terms in marketplace DMs (support use). */
export function profileBypassesMessagePolicy(
  profile: MessagePolicyStaffProfile | null | undefined,
): boolean {
  return profile?.is_admin === true || profile?.is_employee === true
}

export async function getMessagePolicyViolationForSender(
  supabase: SupabaseClient,
  senderId: string,
  text: string,
): Promise<MessagePolicyReasonCode | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee, created_at, phone")
    .eq("id", senderId)
    .maybeSingle()

  if (profileBypassesMessagePolicy(profile)) {
    return null
  }

  const universalViolation = detectMessagePolicyViolation(text)
  if (universalViolation) return universalViolation

  const trustProfile =
    profile && typeof profile.created_at === "string"
      ? {
          createdAt: profile.created_at,
          phone: typeof profile.phone === "string" ? profile.phone : null,
        }
      : null

  const { isEstablished } = await evaluateMessageSenderTrust(supabase, senderId, trustProfile)
  if (!isEstablished && detectExternalLinkPolicyViolation(text)) {
    return "external_link"
  }

  return null
}

/**
 * Same as {@link getMessagePolicyViolationForSender}, plus a cross-message check:
 * phone numbers split into short digit-only messages ("843" / "997" / "5252")
 * are caught by combining the sender's trailing digit-only messages with the
 * new one. Blocked fragments are never inserted, so the run rebuilds naturally
 * if the sender keeps trying.
 */
export async function getMessagePolicyViolationForSenderInConversation(
  supabase: SupabaseClient,
  senderId: string,
  conversationId: string,
  text: string,
): Promise<MessagePolicyReasonCode | null> {
  const singleMessageViolation = await getMessagePolicyViolationForSender(supabase, senderId, text)
  if (singleMessageViolation) return singleMessageViolation

  if (!messageIsPhoneNumberFragmentCandidate(text)) return null

  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin, is_employee")
    .eq("id", senderId)
    .maybeSingle()
  if (profileBypassesMessagePolicy(profile)) return null

  const recent = await getTrailingMessagesForConversation(supabase, conversationId, 6)

  // Only the sender's unbroken trailing run counts — a reply from the other
  // party in between breaks the fragment chain.
  const priorFragments: string[] = []
  for (const row of recent) {
    if (row.sender_id !== senderId) break
    priorFragments.unshift(row.content)
  }

  if (fragmentsCombineIntoPhoneNumber(priorFragments, text)) {
    return "phone_fragment"
  }

  return null
}
