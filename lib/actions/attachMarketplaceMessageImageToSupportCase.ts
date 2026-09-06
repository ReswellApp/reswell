"use server"

import { revalidatePath } from "next/cache"
import { attachMarketplaceMessageImageToSupportCaseService } from "@/lib/services/attachMarketplaceMessageImageToSupportCase"

export async function attachMarketplaceMessageImageToSupportCaseAction(raw: unknown) {
  const result = await attachMarketplaceMessageImageToSupportCaseService(raw)
  if ("error" in result) return { error: result.error }

  if (
    typeof raw === "object" &&
    raw !== null &&
    "order_support_request_id" in raw &&
    typeof (raw as { order_support_request_id: unknown }).order_support_request_id === "string"
  ) {
    const id = (raw as { order_support_request_id: string }).order_support_request_id
    revalidatePath("/admin/contact-messages")
    revalidatePath(`/admin/support/${id}`)
    revalidatePath(`/support/${id}`)
    revalidatePath(`/dashboard/support/order/${id}`)
  }

  return result
}
