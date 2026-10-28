import { createClient } from "@/lib/supabase/server"

/**
 * Support tickets are not marketplace DMs. Callers that used to open a
 * member↔support conversation must send the member to Help instead.
 */
export async function openMessagesDirectSupportConversationService(): Promise<
  { success: true; conversation_id: string } | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Unauthorized" }
  }

  return {
    error: "Reswell Support lives in Help, not Messages. Open a case from Help to reach the team.",
  }
}
