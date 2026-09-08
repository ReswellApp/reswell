"use server"

import { revalidatePath } from "next/cache"
import { updateSupportCaseInboxService } from "@/lib/services/supportCaseInbox"

export async function updateSupportCaseInboxAction(raw: unknown) {
  const result = await updateSupportCaseInboxService(raw)
  if ("error" in result) return { error: result.error }

  revalidatePath("/admin/contact-messages")
  revalidatePath("/dashboard/support")
  if (
    typeof raw === "object" &&
    raw !== null &&
    "case_id" in raw &&
    typeof raw.case_id === "string"
  ) {
    revalidatePath(`/admin/support/${raw.case_id}`)
    revalidatePath(`/support/${raw.case_id}`)
  }
  return { success: true as const, status: result.status }
}
