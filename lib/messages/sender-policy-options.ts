import type { SupabaseClient } from "@supabase/supabase-js"
import type { DetectMessagePolicyViolationOptions } from "@/lib/utils/detect-message-policy-violation"

/**
 * Marketplace admins may share phone numbers in DMs (e.g. support callbacks).
 * Email and off-platform payment rules still apply.
 */
export async function loadMessagePolicyOptionsForSender(
  supabase: SupabaseClient,
  senderId: string,
): Promise<DetectMessagePolicyViolationOptions> {
  const { data, error } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", senderId)
    .maybeSingle()

  if (error) {
    console.error("[loadMessagePolicyOptionsForSender]", error.message)
    return {}
  }

  return { allowPhoneSharing: data?.is_admin === true }
}
