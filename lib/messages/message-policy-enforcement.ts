import type { SupabaseClient } from "@supabase/supabase-js"
import type { MessagePolicyReasonCode } from "@/lib/messages/fraud-reason-codes"
import { detectMessagePolicyViolation } from "@/lib/utils/detect-message-policy-violation"

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
    .select("is_admin, is_employee")
    .eq("id", senderId)
    .maybeSingle()

  if (profileBypassesMessagePolicy(profile)) {
    return null
  }

  return detectMessagePolicyViolation(text)
}
