"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { respondToCounterOfferService } from "@/lib/services/respondToCounterOffer"
import { respondToCounterOfferSchema } from "@/lib/validations/respond-to-counter-offer"

export async function respondToCounterOfferAction(raw: unknown) {
  const parsed = respondToCounterOfferSchema.safeParse(raw)
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

  const result = await respondToCounterOfferService(supabase, user.id, parsed.data)
  if (!result.ok) {
    return { error: result.error as string }
  }

  revalidatePath("/messages")
  revalidatePath("/dashboard/offers")
  if (result.conversationId) {
    revalidatePath(`/messages/${result.conversationId}`)
  }

  return { success: true as const }
}
