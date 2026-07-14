"use server"

import { revalidatePath } from "next/cache"
import {
  bulkUpdateContactMessagesAdminService,
  ensureSupportTicketThreadAdminService,
  sendSupportTicketAdminReplyService,
  updateContactMessageAdminService,
} from "@/lib/services/contactMessagesAdmin"

function revalidateSupportTicketPaths(ticketId?: string) {
  revalidatePath("/admin/contact-messages")
  revalidatePath("/dashboard/support")
  if (ticketId) {
    revalidatePath(`/admin/contact-messages/${ticketId}`)
    revalidatePath(`/dashboard/support/${ticketId}`)
  }
}

export async function updateContactMessageAdminAction(raw: unknown) {
  const result = await updateContactMessageAdminService(raw)
  if ("error" in result) {
    return { error: result.error as string }
  }
  const ticketId =
    typeof raw === "object" && raw !== null && "id" in raw && typeof raw.id === "string"
      ? raw.id
      : undefined
  revalidateSupportTicketPaths(ticketId)
  return { success: true as const }
}

export async function bulkUpdateContactMessagesAdminAction(raw: unknown) {
  const result = await bulkUpdateContactMessagesAdminService(raw)
  if ("error" in result) {
    return { error: result.error as string }
  }
  revalidateSupportTicketPaths()
  return { success: true as const }
}

export async function ensureSupportTicketThreadAdminAction(raw: unknown) {
  const result = await ensureSupportTicketThreadAdminService(raw)
  if ("error" in result) {
    return { error: result.error as string }
  }
  const ticketId =
    typeof raw === "object" && raw !== null && "ticket_id" in raw && typeof raw.ticket_id === "string"
      ? raw.ticket_id
      : undefined
  revalidateSupportTicketPaths(ticketId)
  return { success: true as const, support_conversation_id: result.support_conversation_id }
}

export async function sendSupportTicketAdminReplyAction(raw: unknown) {
  const result = await sendSupportTicketAdminReplyService(raw)
  if ("error" in result) {
    return { error: result.error as string }
  }
  const ticketId =
    typeof raw === "object" && raw !== null && "ticket_id" in raw && typeof raw.ticket_id === "string"
      ? raw.ticket_id
      : undefined
  revalidateSupportTicketPaths(ticketId)
  return { success: true as const, support_conversation_id: result.support_conversation_id }
}
