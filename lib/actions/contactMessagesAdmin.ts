"use server"

import { revalidatePath } from "next/cache"
import {
  bulkUpdateContactMessagesAdminService,
  ensureSupportTicketThreadAdminService,
  sendSupportTicketAdminReplyService,
  updateContactMessageAdminService,
} from "@/lib/services/contactMessagesAdmin"

export async function updateContactMessageAdminAction(raw: unknown) {
  const result = await updateContactMessageAdminService(raw)
  if ("error" in result) {
    return { error: result.error as string }
  }
  revalidatePath("/admin/contact-messages")
  return { success: true as const }
}

export async function bulkUpdateContactMessagesAdminAction(raw: unknown) {
  const result = await bulkUpdateContactMessagesAdminService(raw)
  if ("error" in result) {
    return { error: result.error as string }
  }
  revalidatePath("/admin/contact-messages")
  return { success: true as const }
}

export async function ensureSupportTicketThreadAdminAction(raw: unknown) {
  const result = await ensureSupportTicketThreadAdminService(raw)
  if ("error" in result) {
    return { error: result.error as string }
  }
  revalidatePath("/admin/contact-messages")
  return { success: true as const, support_conversation_id: result.support_conversation_id }
}

export async function sendSupportTicketAdminReplyAction(raw: unknown) {
  const result = await sendSupportTicketAdminReplyService(raw)
  if ("error" in result) {
    return { error: result.error as string }
  }
  revalidatePath("/admin/contact-messages")
  return { success: true as const, support_conversation_id: result.support_conversation_id }
}
