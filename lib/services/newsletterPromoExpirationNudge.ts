import type { SupabaseClient } from "@supabase/supabase-js"

import {
  NEWSLETTER_PROMO_EXPIRATION_BUMP_PERCENT,
  NEWSLETTER_PROMO_EXPIRATION_NUDGE_DAYS_BEFORE,
} from "@/lib/constants/newsletter-promo"
import {
  bumpNewsletterPromoDiscountPercent,
  expirationNudgeTargetDateIso,
  fetchNewsletterPromosEligibleForExpirationNudge,
  recordNewsletterPromoExpirationNudge,
} from "@/lib/db/newsletterPromoExpirationNudge"
import { trackKlaviyoNewsletterPromoExpiring } from "@/lib/klaviyo/track-newsletter-promo-expiring"

const BATCH_SIZE = 10

export type ProcessNewsletterPromoExpirationNudgeSummary = {
  daysBeforeExpiry: number
  bumpedPercent: number
  targetExpiryDate: string
  eligible: number
  bumped: number
  klaviyoEmitted: number
  failed: number
  errors: string[]
}

/**
 * For unredeemed newsletter promos expiring in ~3 days: bump discount to 15% (same code)
 * and emit Klaviyo **Newsletter Promo Expiring** with the promo code for the reminder email.
 */
export async function processNewsletterPromoExpirationNudge(
  supabase: SupabaseClient,
  referenceTime: Date = new Date(),
): Promise<ProcessNewsletterPromoExpirationNudgeSummary> {
  const { data: eligibleRows, error: fetchErr } =
    await fetchNewsletterPromosEligibleForExpirationNudge(supabase, referenceTime)

  if (fetchErr) {
    return {
      daysBeforeExpiry: NEWSLETTER_PROMO_EXPIRATION_NUDGE_DAYS_BEFORE,
      bumpedPercent: NEWSLETTER_PROMO_EXPIRATION_BUMP_PERCENT,
      targetExpiryDate: expirationNudgeTargetDateIso(referenceTime),
      eligible: 0,
      bumped: 0,
      klaviyoEmitted: 0,
      failed: 0,
      errors: [fetchErr],
    }
  }

  const errors: string[] = []
  let bumped = 0
  let klaviyoEmitted = 0
  let failed = 0

  for (let offset = 0; offset < eligibleRows.length; offset += BATCH_SIZE) {
    const slice = eligibleRows.slice(offset, offset + BATCH_SIZE)
    const batchOutcomes = await Promise.all(
      slice.map(async (row) => {
        const bumpResult = await bumpNewsletterPromoDiscountPercent(supabase, {
          promoId: row.promo_id,
          bumpedDiscountPercent: NEWSLETTER_PROMO_EXPIRATION_BUMP_PERCENT,
        })

        if (!bumpResult.ok || bumpResult.previousDiscountPercent === null) {
          return {
            ok: false as const,
            bumped: false,
            klaviyoEmitted: false,
            error: `${row.code}: bump failed — ${bumpResult.error ?? "unknown"}`,
          }
        }

        const didBump = bumpResult.previousDiscountPercent < NEWSLETTER_PROMO_EXPIRATION_BUMP_PERCENT

        const klaviyoResult = await trackKlaviyoNewsletterPromoExpiring({
          email: row.email,
          promoCode: row.code,
          discountPercent: NEWSLETTER_PROMO_EXPIRATION_BUMP_PERCENT,
          previousDiscountPercent: bumpResult.previousDiscountPercent,
          expiresAt: row.expires_at,
          promoId: row.promo_id,
        })

        if (!klaviyoResult.ok && !klaviyoResult.skipped) {
          return {
            ok: false as const,
            bumped: didBump,
            klaviyoEmitted: false,
            error: `${row.code}: Klaviyo ${klaviyoResult.status} — ${klaviyoResult.detail.slice(0, 200)}`,
          }
        }

        if (!klaviyoResult.ok) {
          return { ok: false as const, bumped: didBump, klaviyoEmitted: false, error: null }
        }

        const recordResult = await recordNewsletterPromoExpirationNudge(supabase, {
          promoId: row.promo_id,
          email: row.email,
          code: row.code,
          previousDiscountPercent: bumpResult.previousDiscountPercent,
          bumpedDiscountPercent: NEWSLETTER_PROMO_EXPIRATION_BUMP_PERCENT,
          expiresAt: row.expires_at,
          klaviyoSentAt: new Date().toISOString(),
        })

        if (recordResult.error) {
          return {
            ok: false as const,
            bumped: didBump,
            klaviyoEmitted: true,
            error: `${row.code}: record nudge failed — ${recordResult.error}`,
          }
        }

        return { ok: true as const, bumped: didBump, klaviyoEmitted: true, error: null }
      }),
    )

    for (const outcome of batchOutcomes) {
      if (outcome.bumped) bumped += 1
      if (outcome.klaviyoEmitted) klaviyoEmitted += 1
      if (!outcome.ok && outcome.error) {
        failed += 1
        errors.push(outcome.error)
      }
    }
  }

  return {
    daysBeforeExpiry: NEWSLETTER_PROMO_EXPIRATION_NUDGE_DAYS_BEFORE,
    bumpedPercent: NEWSLETTER_PROMO_EXPIRATION_BUMP_PERCENT,
    targetExpiryDate: expirationNudgeTargetDateIso(referenceTime),
    eligible: eligibleRows.length,
    bumped,
    klaviyoEmitted,
    failed,
    errors: errors.slice(0, 50),
  }
}
