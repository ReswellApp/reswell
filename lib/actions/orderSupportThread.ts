"use server"

import { revalidatePath } from "next/cache"
import {
  ensureOrderSupportThreadService,
  sendOrderSupportAdminReplyService,
  sendOrderSupportMemberReplyService,
} from "@/lib/services/orderSupportThread"

function revalidateOrderCase(caseId?: string) {
  revalidatePath("/admin/contact-messages")
  revalidatePath("/dashboard/support")
  if (caseId) {
    revalidatePath(`/support/${caseId}`)
    revalidatePath(`/admin/support/${caseId}`)
    revalidatePath(`/dashboard/support/order/${caseId}`)
  }
}

export async function ensureOrderSupportThreadAdminAction(raw: unknown) {
  const caseId =
    typeof raw === "object" && raw !== null && "case_id" in raw && typeof raw.case_id === "string"
      ? raw.case_id
      : null
  if (!caseId) return { error: "Invalid input" }

  const result = await ensureOrderSupportThreadService(caseId)
  if ("error" in result) return { error: result.error }
  revalidateOrderCase(caseId)
  return { success: true as const, support_conversation_id: result.support_conversation_id }
}

export async function sendOrderSupportAdminReplyAction(raw: unknown) {
  const result = await sendOrderSupportAdminReplyService(raw)
  if ("error" in result) return { error: result.error }
  const caseId =
    typeof raw === "object" && raw !== null && "case_id" in raw && typeof raw.case_id === "string"
      ? raw.case_id
      : undefined
  revalidateOrderCase(caseId)
  return { success: true as const, support_conversation_id: result.support_conversation_id }
}

export async function sendOrderSupportMemberReplyAction(raw: unknown) {
  const result = await sendOrderSupportMemberReplyService(raw)
  if ("error" in result) return { error: result.error }
  const caseId =
    typeof raw === "object" && raw !== null && "case_id" in raw && typeof raw.case_id === "string"
      ? raw.case_id
      : undefined
  revalidateOrderCase(caseId)
  return { success: true as const }
}
