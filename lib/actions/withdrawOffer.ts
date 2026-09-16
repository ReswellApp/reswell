"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { withdrawListingOffer } from "@/lib/services/withdrawListingOffer"
import { withdrawOfferSchema } from "@/lib/validations/withdraw-offer"
import { captureServerEvent } from "@/lib/posthog-server"

export async function withdrawOfferAction(raw: unknown) {
  const parsed = withdrawOfferSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: "Invalid input." as const }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Sign in to withdraw." as const }
  }

  const result = await withdrawListingOffer(supabase, user.id, parsed.data.offerId)
  if (!result.ok) {
    return { error: result.error }
  }

  revalidatePath("/dashboard/offers")

  await captureServerEvent(user.id, "offer_withdrawn", {
    offer_id: parsed.data.offerId,
  })

  return { success: true as const, conversationId: result.conversationId }
}
