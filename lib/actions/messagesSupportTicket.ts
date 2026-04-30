"use server"

import { submitMessagesSupportTicketService } from "@/lib/services/messagesSupportTicket"

export async function submitMessagesSupportTicketAction(raw: unknown) {
  return submitMessagesSupportTicketService(raw)
}
