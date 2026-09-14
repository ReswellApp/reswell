"use server"

import { revalidatePath } from "next/cache"
import {
  getOrCreateSupportReplyDraftService,
  recordSupportReplyFeedbackService,
} from "@/lib/services/supportReplyDraft"

export async function getSupportReplyDraftAction(raw: unknown) {
  return getOrCreateSupportReplyDraftService(raw)
}

export async function regenerateSupportReplyDraftAction(raw: unknown) {
  const result = await getOrCreateSupportReplyDraftService(
    typeof raw === "object" && raw !== null ? { ...raw, force: true } : raw,
  )
  if ("data" in result) {
    revalidatePath("/admin/contact-messages")
    revalidatePath(`/admin/support/${result.data.caseId}`)
  }
  return result
}

export async function rateSupportReplyDraftAction(raw: unknown) {
  const result = await recordSupportReplyFeedbackService(raw)
  if ("success" in result) {
    revalidatePath("/admin/contact-messages")
  }
  return result
}
