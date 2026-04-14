"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { respondToOfferService } from "@/lib/services/respondToOffer"
import { respondToOfferSchema } from "@/lib/validations/respond-to-offer"

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

  revalidatePath("/messages")
  revalidatePath("/dashboard/offers")
  if (result.conversationId) {
    revalidatePath(`/messages/${result.conversationId}`)
  }

  return { success: true as const }
}
