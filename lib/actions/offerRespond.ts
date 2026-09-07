"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { respondToOfferService } from "@/lib/services/respondToOffer"
import { respondToOfferSchema } from "@/lib/validations/respond-to-offer"
import { captureServerEvent } from "@/lib/posthog-server"

export async function respondToOfferAction(raw: unknown) {
  const parsed = respondToOfferSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: "Invalid input." as const }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Sign in to respond." as const }
  }

  const result = await respondToOfferService(supabase, user.id, parsed.data)
  if (!result.ok) {
    return { error: result.error as string }
  }

  revalidatePath("/dashboard/offers")

  if (parsed.data.action === "accept") {
    await captureServerEvent(user.id, "offer_accepted", {
      offer_id: parsed.data.offerId,
    })
  }

  return { success: true as const }
}
