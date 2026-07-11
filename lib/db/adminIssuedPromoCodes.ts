import type { SupabaseClient } from "@supabase/supabase-js"

export type AdminIssuedPromoCodeRow = {
  id: string
  code: string
  discount_percent: number
  note: string | null
  expires_at: string
  created_by_profile_id: string | null
  redeemed_at: string | null
  redeemed_by_profile_id: string | null
  redeemed_order_id: string | null
  reserved_payment_intent_id: string | null
  created_at: string
}

const SELECT_COLS =
  "id, code, discount_percent, note, expires_at, created_by_profile_id, redeemed_at, redeemed_by_profile_id, redeemed_order_id, reserved_payment_intent_id, created_at"

export async function fetchAdminIssuedPromoByCode(
  supabase: SupabaseClient,
  code: string,
): Promise<{ row: AdminIssuedPromoCodeRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("admin_issued_promo_codes")
    .select(SELECT_COLS)
    .eq("code", code)
    .maybeSingle()

  if (error) return { row: null, error: error.message }
  return { row: (data as AdminIssuedPromoCodeRow | null) ?? null, error: null }
}

export async function insertAdminIssuedPromoCode(
  supabase: SupabaseClient,
  input: {
    code: string
    discountPercent: number
    expiresAt: string
    createdByProfileId: string
    note?: string | null
  },
): Promise<{ row: AdminIssuedPromoCodeRow | null; error: string | null }> {
  const { data, error } = await supabase
    .from("admin_issued_promo_codes")
    .insert({
      code: input.code,
      discount_percent: input.discountPercent,
      expires_at: input.expiresAt,
      created_by_profile_id: input.createdByProfileId,
      note: input.note?.trim() || null,
    })
    .select(SELECT_COLS)
    .single()

  if (error) return { row: null, error: error.message }
  return { row: data as AdminIssuedPromoCodeRow, error: null }
}

export async function reserveAdminIssuedPromoForPaymentIntent(
  supabase: SupabaseClient,
  promoId: string,
  paymentIntentId: string,
): Promise<{ ok: boolean; error: string | null }> {
  const { data, error } = await supabase
    .from("admin_issued_promo_codes")
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

export async function redeemAdminIssuedPromoForOrder(
  supabase: SupabaseClient,
  input: {
    promoId: string
    buyerId: string
    orderId: string
    paymentIntentId: string | null
  },
): Promise<{ ok: boolean; error: string | null }> {
  let query = supabase
    .from("admin_issued_promo_codes")
    .update({
      redeemed_at: new Date().toISOString(),
      redeemed_by_profile_id: input.buyerId,
      redeemed_order_id: input.orderId,
      reserved_payment_intent_id: null,
    })
    .eq("id", input.promoId)
    .is("redeemed_at", null)

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

export async function clearAdminIssuedPromoReservation(
  supabase: SupabaseClient,
  promoId: string,
  paymentIntentId: string,
): Promise<void> {
  await supabase
    .from("admin_issued_promo_codes")
    .update({ reserved_payment_intent_id: null })
    .eq("id", promoId)
    .eq("reserved_payment_intent_id", paymentIntentId)
}
