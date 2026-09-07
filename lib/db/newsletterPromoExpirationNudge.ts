import type { SupabaseClient } from "@supabase/supabase-js"

import {
  NEWSLETTER_PROMO_EXPIRATION_BUMP_PERCENT,
  NEWSLETTER_PROMO_EXPIRATION_NUDGE_DAYS_BEFORE,
} from "@/lib/constants/newsletter-promo"

export { NEWSLETTER_PROMO_EXPIRATION_NUDGE_DAYS_BEFORE }

export type NewsletterPromoExpirationNudgeEligibleRow = {
  promo_id: string
  email: string
  code: string
  discount_percent: number
  expires_at: string
  created_at: string
}

export function expirationNudgeTargetDateIso(referenceTime: Date): string {
  const target = new Date(referenceTime)
  target.setUTCDate(target.getUTCDate() + NEWSLETTER_PROMO_EXPIRATION_NUDGE_DAYS_BEFORE)
  return target.toISOString().slice(0, 10)
}

export async function fetchNewsletterPromosEligibleForExpirationNudge(
  supabase: SupabaseClient,
  referenceTime: Date,
): Promise<{ data: NewsletterPromoExpirationNudgeEligibleRow[]; error: string | null }> {
  const { data, error } = await supabase.rpc("newsletter_promos_eligible_for_expiration_nudge", {
    p_reference_time: referenceTime.toISOString(),
    p_bumped_discount_percent: NEWSLETTER_PROMO_EXPIRATION_BUMP_PERCENT,
  })

  if (error) {
    return { data: [], error: error.message }
  }

  const rows = Array.isArray(data) ? data : []
  const typed: NewsletterPromoExpirationNudgeEligibleRow[] = rows.map((r: Record<string, unknown>) => ({
    promo_id: String(r.promo_id),
    email: String(r.email),
    code: String(r.code),
    discount_percent: Number(r.discount_percent),
    expires_at: String(r.expires_at),
    created_at: String(r.created_at),
  }))

  return { data: typed, error: null }
}

export async function bumpNewsletterPromoDiscountPercent(
  supabase: SupabaseClient,
  input: {
    promoId: string
    bumpedDiscountPercent: number
  },
): Promise<{ ok: boolean; previousDiscountPercent: number | null; error: string | null }> {
  const { data: existing, error: fetchErr } = await supabase
    .from("newsletter_promo_codes")
    .select("discount_percent")
    .eq("id", input.promoId)
    .is("redeemed_at", null)
    .maybeSingle()

  if (fetchErr) {
    return { ok: false, previousDiscountPercent: null, error: fetchErr.message }
  }
  if (!existing) {
    return { ok: false, previousDiscountPercent: null, error: "Promo code is no longer eligible." }
  }

  const previousDiscountPercent = Number(existing.discount_percent)
  if (!Number.isFinite(previousDiscountPercent)) {
    return { ok: false, previousDiscountPercent: null, error: "Invalid promo discount." }
  }
  if (previousDiscountPercent >= input.bumpedDiscountPercent) {
    return { ok: true, previousDiscountPercent, error: null }
  }

  const { data, error } = await supabase
    .from("newsletter_promo_codes")
    .update({ discount_percent: input.bumpedDiscountPercent })
    .eq("id", input.promoId)
    .is("redeemed_at", null)
    .lt("discount_percent", input.bumpedDiscountPercent)
    .select("id")
    .maybeSingle()

  if (error) {
    return { ok: false, previousDiscountPercent, error: error.message }
  }

  return { ok: Boolean(data?.id), previousDiscountPercent, error: null }
}

export type RecordNewsletterPromoExpirationNudgeInput = {
  promoId: string
  email: string
  code: string
  previousDiscountPercent: number
  bumpedDiscountPercent: number
  expiresAt: string
  klaviyoSentAt: string | null
}

export async function recordNewsletterPromoExpirationNudge(
  supabase: SupabaseClient,
  input: RecordNewsletterPromoExpirationNudgeInput,
): Promise<{ error: string | null }> {
  const { error } = await supabase.from("newsletter_promo_expiration_nudges").upsert(
    {
      promo_code_id: input.promoId,
      email: input.email,
      code: input.code,
      previous_discount_percent: input.previousDiscountPercent,
      bumped_discount_percent: input.bumpedDiscountPercent,
      expires_at: input.expiresAt,
      klaviyo_sent_at: input.klaviyoSentAt,
    },
    { onConflict: "promo_code_id" },
  )

  if (error) return { error: error.message }
  return { error: null }
}

/** Clears prior expiration-nudge rows so a replaced code can be nudged again near the new expiry. */
export async function clearNewsletterPromoExpirationNudgesForPromo(
  supabase: SupabaseClient,
  promoId: string,
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("newsletter_promo_expiration_nudges")
    .delete()
    .eq("promo_code_id", promoId)

  if (error) return { error: error.message }
  return { error: null }
}
