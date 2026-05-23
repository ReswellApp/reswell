import { createClient } from "@/lib/supabase/server"
import { getConversationForBuyerSellerListing, ensureConversationBetweenBuyerAndSeller } from "@/lib/db/conversations"
import { resolveSupportRecipientUserId } from "@/lib/services/resolveSupportRecipientUser"

/**
 * Ensures an in-app DM thread exists between the current user (buyer) and the
 * configured support teammate (seller). Mirrors listing-initiated marketplace threads.
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

  const resolved = await resolveSupportRecipientUserId()
  if (!resolved.ok) {
    return { error: resolved.error }
  }

  const supportUserId = resolved.userId
  if (supportUserId === user.id) {
    return {
      error:
        "You’re signed in as the configured support user, so you can’t DM yourself. Test with another account, or set MESSAGES_DIRECT_SUPPORT_USER_ID / MESSAGES_DIRECT_SUPPORT_EMAIL to a dedicated inbox.",
    }
  }

  const existing = await getConversationForBuyerSellerListing(supabase, user.id, supportUserId, null)
  if (existing) {
    return { success: true, conversation_id: existing.id }
  }

  const ensured = await ensureConversationBetweenBuyerAndSeller(supabase, user.id, supportUserId)
  if (!ensured) {
    return { error: "Couldn’t open chat. Try again in a moment, or send a ticket instead." }
  }

  return { success: true, conversation_id: ensured.id }
}
