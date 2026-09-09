"use server"

import { revalidatePath } from "next/cache"
import {
  getSupportCaseCustomerContextService,
  linkSupportCaseOrderService,
} from "@/lib/services/supportCaseCustomerContext"

export async function getSupportCaseCustomerContextAction(caseId: string) {
  return getSupportCaseCustomerContextService({ case_id: caseId })
}

export async function linkSupportCaseOrderAction(raw: unknown) {
  const result = await linkSupportCaseOrderService(raw)
  if ("error" in result) return result

  revalidatePath("/admin/contact-messages")
  revalidatePath("/dashboard/support")
  revalidatePath(`/admin/orders/${result.order.id}`)
  if (
    typeof raw === "object" &&
    raw !== null &&
    "case_id" in raw &&
    typeof raw.case_id === "string"
  ) {
    revalidatePath(`/admin/support/${raw.case_id}`)
    revalidatePath(`/support/${raw.case_id}`)
  }
  return result
}
