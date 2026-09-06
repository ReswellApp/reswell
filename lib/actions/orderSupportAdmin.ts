"use server"

import { revalidatePath } from "next/cache"
import { updateOrderSupportAdminService } from "@/lib/services/orderSupportAdmin"

export async function updateOrderSupportAdminAction(raw: unknown) {
  const result = await updateOrderSupportAdminService(raw)
  if ("error" in result) {
    return { error: result.error }
  }
  revalidatePath("/admin/contact-messages")
  revalidatePath("/dashboard/support")
  if (
    typeof raw === "object" &&
    raw !== null &&
    "id" in raw &&
    typeof raw.id === "string"
  ) {
    revalidatePath(`/support/${raw.id}`)
    revalidatePath(`/admin/support/${raw.id}`)
    revalidatePath(`/dashboard/support/order/${raw.id}`)
  }
  return { success: true as const }
}
