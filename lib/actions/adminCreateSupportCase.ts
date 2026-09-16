"use server"

import { revalidatePath } from "next/cache"
import {
  adminCreateSupportCaseService,
  listAdminUserOrdersForSupportService,
} from "@/lib/services/adminCreateSupportCase"

export async function listAdminUserOrdersForSupportAction(raw: unknown) {
  return listAdminUserOrdersForSupportService(raw)
}

export async function adminCreateSupportCaseAction(raw: unknown) {
  const result = await adminCreateSupportCaseService(raw)
  if ("error" in result) return result

  revalidatePath("/admin/contact-messages")
  revalidatePath("/dashboard/support")
  revalidatePath(`/support/${result.caseId}`)
  revalidatePath(`/admin/support/${result.caseId}`)
  if (result.orderId) {
    revalidatePath(`/admin/orders/${result.orderId}`)
  }
  return result
}
