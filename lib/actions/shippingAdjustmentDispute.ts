"use server"

import { revalidatePath } from "next/cache"
import { submitShippingAdjustmentDispute } from "@/lib/services/shippingAdjustmentDispute"

export async function submitShippingAdjustmentDisputeAction(raw: unknown) {
  const result = await submitShippingAdjustmentDispute(raw)
  if ("error" in result) return { error: result.error }
  const orderId =
    typeof raw === "object" && raw !== null && "orderId" in raw && typeof raw.orderId === "string"
      ? raw.orderId
      : null
  if (orderId) revalidatePath(`/dashboard/sales/${orderId}`)
  revalidatePath("/dashboard/earnings")
  revalidatePath("/admin/shipping")
  return { success: true as const }
}
