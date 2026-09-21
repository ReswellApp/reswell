"use server"

import { submitMessagesSupportTicketService } from "@/lib/services/messagesSupportTicket"

/** after() writes the inbox draft. Default 15s kills that CS-agent work. */
export const maxDuration = 60

export async function submitMessagesSupportTicketAction(raw: unknown) {
  return submitMessagesSupportTicketService(raw)
}
