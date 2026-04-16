"use server"

import { revalidatePath } from "next/cache"
import { updateContactMessageAdminService } from "@/lib/services/contactMessagesAdmin"

export async function updateContactMessageAdminAction(raw: unknown) {
  const result = await updateContactMessageAdminService(raw)
  if ("error" in result) {
    return { error: result.error as string }
  }
  revalidatePath("/admin/contact-messages")
  return { success: true as const }
}
