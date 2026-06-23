import type { SupabaseClient } from "@supabase/supabase-js"

export type NewsletterPromoCodeRow = {
  id: string
  email: string
  code: string
  discount_percent: number
  expires_at: string
  redeemed_at: string | null
  redeemed_by_profile_id: string | null
  redeemed_order_id: string | null
  reserved_payment_intent_id: string | null
  created_at: string
}

const SELECT_COLS =
  "id, email, code, discount_percent, expires_at, redeemed_at, redeemed_by_profile_id, redeemed_order_id, reserved_payment_intent_id, created_at"

export async function fetchNewsletterPromoByCode(
  supabase: SupabaseClient,
  code: string,
): Promise<{ row: NewsletterPromoCodeRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("newsletter_promo_codes")
    .select(SELECT_COLS)
    .eq("code", code)
    .maybeSingle()

  if (error) return { row: null, error: error.message }
  return { row: (data as NewsletterPromoCodeRow | null) ?? null, error: null }
}

export async function fetchNewsletterPromoForEmail(
  supabase: SupabaseClient,
  email: string,
): Promise<{ row: NewsletterPromoCodeRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("newsletter_promo_codes")
    .select(SELECT_COLS)
    .eq("email", email)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) return { row: null, error: error.message }
  return { row: (data as NewsletterPromoCodeRow | null) ?? null, error: null }
}

export async function insertNewsletterPromoCode(
  supabase: SupabaseClient,
  input: {
    email: string
    code: string
    discountPercent: number
    expiresAt: string
  },
): Promise<{ row: NewsletterPromoCodeRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("newsletter_promo_codes")
    .insert({
      email: input.email,
      code: input.code,
      discount_percent: input.discountPercent,
      expires_at: input.expiresAt,
    })
    .select(SELECT_COLS)
    .single()

  if (error) return { row: null, error: error.message }
  return { row: data as NewsletterPromoCodeRow, error: null }
}

export async function reserveNewsletterPromoForPaymentIntent(
  supabase: SupabaseClient,
  promoId: string,
  paymentIntentId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { data, error } = await supabase
    .from("newsletter_promo_codes")
    .update({ reserved_payment_intent_id: paymentIntentId })
    .eq("id", promoId)
    .is("redeemed_at", null)
    .is("reserved_payment_intent_id", null)
    .select("id")
    .maybeSingle()

  if (error) return { ok: false, error: error.message }
  if (!data?.id) {
    return { ok: false, error: "This promo code is no longer available." }
  }
  return { ok: true, error: null }
}

export async function redeemNewsletterPromoForOrder(
  supabase: SupabaseClient,
  input: {
    promoId: string
    buyerId: string
    orderId: string
    paymentIntentId: string | null
  },
): Promise<{ ok: boolean; error: string | null }> {
  let query = supabase
    .from("newsletter_promo_codes")
    .update({
      redeemed_at: new Date().toISOString(),
      redeemed_by_profile_id: input.buyerId,
      redeemed_order_id: input.orderId,
      reserved_payment_intent_id: null,
    })
    .eq("id", input.promoId)
    .is("redeemed_at", null)

  // PostgREST rejects `.or()` filters on UPDATE for this column (42703); use eq/is instead.
  const reservedPiId = input.paymentIntentId?.trim()
  if (reservedPiId) {
    query = query.eq("reserved_payment_intent_id", reservedPiId)
  } else {
    query = query.is("reserved_payment_intent_id", null)
  }

  const { data, error } = await query.select("id").maybeSingle()

  if (error) return { ok: false, error: error.message }
  return { ok: Boolean(data?.id), error: null }
}

export async function clearNewsletterPromoReservation(
  supabase: SupabaseClient,
  promoId: string,
  paymentIntentId: string,
): Promise<void> {
  await supabase
    .from("newsletter_promo_codes")
    .update({ reserved_payment_intent_id: null })
    .eq("id", promoId)
    .eq("reserved_payment_intent_id", paymentIntentId)
}
