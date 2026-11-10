"use server"

import { submitSurfShopPartnerApplicationService } from "@/lib/services/surfShopPartner"
import { surfShopPartnerApplicationSchema } from "@/lib/validations/surfShopPartner"

export async function submitSurfShopPartnerApplication(input: unknown) {
  const parsed = surfShopPartnerApplicationSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid application"
    return { error: first }
  }

  const result = await submitSurfShopPartnerApplicationService(parsed.data)
  if ("error" in result) {
    return { error: result.error }
  }
  return { success: true as const, ticketId: result.ticketId }
}
