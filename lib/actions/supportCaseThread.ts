"use server"

import { revalidatePath } from "next/cache"
import {
  getSupportCaseThreadForStaff,
  sendSupportCaseAdminReplyService,
  sendSupportCaseMemberReplyService,
} from "@/lib/services/supportCaseThread"

/** after() writes the inbox draft. Default 15s kills that CS-agent work. */
export const maxDuration = 60

function revalidateCase(caseId?: string) {
  revalidatePath("/dashboard/support")
  revalidatePath("/admin/contact-messages")
  if (caseId) {
    revalidatePath(`/support/${caseId}`)
    revalidatePath(`/admin/support/${caseId}`)
  }
}

export async function getSupportCaseThreadAdminAction(caseId: string) {
  return getSupportCaseThreadForStaff(caseId)
}

export async function sendSupportCaseMemberReplyAction(raw: unknown) {
  const result = await sendSupportCaseMemberReplyService(raw)
  if ("error" in result) return { error: result.error }
  revalidateCase(result.case_id)
  return { success: true as const, case_id: result.case_id }
}

export async function sendSupportCaseAdminReplyAction(raw: unknown) {
  const result = await sendSupportCaseAdminReplyService(raw)
  if ("error" in result) return { error: result.error }
  revalidateCase(result.case_id)
  return { success: true as const, case_id: result.case_id }
}
