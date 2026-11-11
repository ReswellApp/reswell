"use server"

import { revalidatePath } from "next/cache"
import { acceptedOfferCheckoutHref } from "@/lib/listing-href"
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

  revalidatePath("/dashboard/offers")

  if (parsed.data.action === "accept") {
    return {
      success: true as const,
      checkoutHref: acceptedOfferCheckoutHref(parsed.data.offerId),
    }
  }

  return { success: true as const }
}
