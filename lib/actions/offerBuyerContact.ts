"use server"

import { createClient } from "@/lib/supabase/server"
import {
  fetchCheckoutBuyerContext,
  type CheckoutBuyerContext,
} from "@/lib/db/checkout-page"

export async function getOfferBuyerContact(): Promise<
  { ok: true; buyer: CheckoutBuyerContext } | { ok: false; error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { ok: false, error: "Sign in to continue." }
  }

  const buyer = await fetchCheckoutBuyerContext(supabase, user)
  return { ok: true, buyer }
}
