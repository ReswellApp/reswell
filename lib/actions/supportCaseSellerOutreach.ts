"use server"

import { revalidatePath } from "next/cache"
import { openSellerSupportOutreachService } from "@/lib/services/supportCaseSellerOutreach"

export async function openSellerSupportOutreachAction(raw: unknown) {
  const result = await openSellerSupportOutreachService(raw)
  if ("error" in result) return result

  revalidatePath("/admin/contact-messages")
  revalidatePath("/dashboard/support")
  revalidatePath(`/support/${result.sellerCaseId}`)
  if (
    typeof raw === "object" &&
    raw !== null &&
    "source_case_id" in raw &&
    typeof raw.source_case_id === "string"
  ) {
    revalidatePath(`/admin/support/${raw.source_case_id}`)
    revalidatePath(`/support/${raw.source_case_id}`)
  }
  return result
}
