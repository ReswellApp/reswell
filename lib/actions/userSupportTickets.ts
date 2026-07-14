"use server"

import { revalidatePath } from "next/cache"
import { sendUserSupportTicketReplyService } from "@/lib/services/userSupportTickets"

export async function sendUserSupportTicketReplyAction(raw: unknown) {
  const result = await sendUserSupportTicketReplyService(raw)
  if ("error" in result) {
    return { error: result.error as string }
  }

  const ticketId =
    typeof raw === "object" &&
    raw !== null &&
    "ticket_id" in raw &&
    typeof (raw as { ticket_id: unknown }).ticket_id === "string"
      ? (raw as { ticket_id: string }).ticket_id
      : null

  revalidatePath("/dashboard/support")
  if (ticketId) {
    revalidatePath(`/dashboard/support/${ticketId}`)
  }

  return { success: true as const }
}
