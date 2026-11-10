"use server"

import { submitSurfboardFlipperOfferService } from "@/lib/services/surfboardFlipperOffer"
import { surfboardFlipperOfferSchema } from "@/lib/validations/surfboardFlipperOffer"

export async function submitSurfboardFlipperOffer(input: unknown) {
  const parsed = surfboardFlipperOfferSchema.safeParse(input)
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid application"
    return { error: first }
  }

  const result = await submitSurfboardFlipperOfferService(parsed.data)
  if ("error" in result) {
    return { error: result.error }
  }
  return { success: true as const, ticketId: result.ticketId }
}
