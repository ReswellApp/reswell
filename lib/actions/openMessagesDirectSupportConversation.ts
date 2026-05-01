"use server"

import { openMessagesDirectSupportConversationService } from "@/lib/services/openMessagesDirectSupportConversation"

export async function openMessagesDirectSupportConversationAction() {
  return openMessagesDirectSupportConversationService()
}
