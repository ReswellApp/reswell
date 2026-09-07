"use server"

import { revalidatePath } from "next/cache"
import { issueOrderSupportCaseRefundService } from "@/lib/services/orderSupportCaseRefund"

export async function issueOrderSupportCaseRefundAction(raw: unknown) {
  const result = await issueOrderSupportCaseRefundService(raw)
  if ("error" in result) return { error: result.error }

  if (
    typeof raw === "object" &&
    raw !== null &&
    "case_id" in raw &&
    typeof raw.case_id === "string"
  ) {
    revalidatePath("/admin/contact-messages")
    revalidatePath(`/admin/support/${raw.case_id}`)
    revalidatePath(`/support/${raw.case_id}`)
  }
  if (
    typeof raw === "object" &&
    raw !== null &&
    "order_id" in raw &&
    typeof raw.order_id === "string"
  ) {
    revalidatePath(`/admin/orders/${raw.order_id}`)
  }

  return {
    success: true as const,
    message: result.message,
    fullyRefundedInApp: result.fullyRefundedInApp,
  }
}
