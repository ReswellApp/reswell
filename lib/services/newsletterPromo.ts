/**
 * Newsletter welcome promos — Reswell-funded discounts at checkout.
 *
 * Seller earnings, platform fees, and order_items.item_price always use the full
 * listing item price. Only orders.amount (buyer charge) and promo_discount_usd reflect the promo.
 */
import {
  NEWSLETTER_PROMO_DISCOUNT_PERCENT,
  NEWSLETTER_PROMO_VALIDITY_DAYS,
} from "@/lib/constants/newsletter-promo"
import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"
import {
  clearNewsletterPromoReservation,
  fetchNewsletterPromoForEmail,
  fetchNewsletterPromoByCode,
  insertNewsletterPromoCode,
  replaceUnredeemedNewsletterPromoCode,
  type NewsletterPromoCodeRow,
} from "@/lib/db/newsletterPromoCodes"
import { clearNewsletterPromoExpirationNudgesForPromo } from "@/lib/db/newsletterPromoExpirationNudge"
import { getStripe } from "@/lib/stripe-server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { generateNewsletterPromoCode, normalizeNewsletterPromoEmail } from "@/lib/utils/newsletter-promo-code"

export type NewsletterPromoValidationResult =
  | {
      ok: true
      promo: NewsletterPromoCodeRow
      discountPercent: number
      discountUsd: number
      totalUsd: number
    }
  | { ok: false; error: string }

export function computeNewsletterPromoItemDiscountUsd(
  itemSubtotalUsd: number,
  discountPercent: number = NEWSLETTER_PROMO_DISCOUNT_PERCENT,
): number {
  const safeItem = Math.max(0, itemSubtotalUsd)
  return Math.round(safeItem * discountPercent) / 100
}

export function computeCheckoutTotalWithNewsletterPromo(params: {
  itemSubtotalUsd: number
  shippingUsd: number
  discountPercent: number
}): { discountUsd: number; totalUsd: number } {
  const discountUsd = computeNewsletterPromoItemDiscountUsd(
    params.itemSubtotalUsd,
    params.discountPercent,
  )
  const totalUsd =
    Math.round((params.itemSubtotalUsd - discountUsd + Math.max(0, params.shippingUsd)) * 100) /
    100
  return { discountUsd, totalUsd }
}

function promoExpiryIso(from = new Date()): string {
  const d = new Date(from)
  d.setUTCDate(d.getUTCDate() + NEWSLETTER_PROMO_VALIDITY_DAYS)
  return d.toISOString()
}

function isPromoExpired(row: NewsletterPromoCodeRow, now = new Date()): boolean {
  return new Date(row.expires_at).getTime() <= now.getTime()
}

function emailsMatch(promoEmail: string, buyerEmail: string): boolean {
  return normalizeNewsletterPromoEmail(promoEmail) === normalizeNewsletterPromoEmail(buyerEmail)
}

/**
 * Cancels an abandoned checkout PaymentIntent and clears its promo reservation so a new
 * intent can be created (e.g. after shipping address changes or React remounts checkout).
 * Leaves reservations tied to succeeded/processing intents untouched.
 * Any other PI status is treated as releasable (not mid-charge).
 */
export async function releaseAbandonedNewsletterPromoReservation(
  stripe: Stripe,
  supabase: SupabaseClient,
  promo: Pick<NewsletterPromoCodeRow, "id" | "reserved_payment_intent_id">,
): Promise<void> {
  const reservedPiId = promo.reserved_payment_intent_id?.trim()
  if (!reservedPiId) return

  try {
    const existingPi = await stripe.paymentIntents.retrieve(reservedPiId)
    if (existingPi.status === "succeeded" || existingPi.status === "processing") {
      return
    }
    if (existingPi.status !== "canceled") {
      await stripe.paymentIntents.cancel(reservedPiId).catch((err) => {
        console.warn("[newsletter-promo] cancel abandoned PI failed:", reservedPiId, err)
      })
    }
    await clearNewsletterPromoReservation(supabase, promo.id, reservedPiId)
  } catch (err) {
    console.warn("[newsletter-promo] retrieve abandoned PI failed:", reservedPiId, err)
    await clearNewsletterPromoReservation(supabase, promo.id, reservedPiId)
  }
}

export async function validateNewsletterPromoForCheckout(params: {
  code: string
  buyerEmail: string
  itemSubtotalUsd: number
  shippingUsd: number
}): Promise<NewsletterPromoValidationResult> {
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Promo codes are temporarily unavailable." }
  }

  const { row, error } = await fetchNewsletterPromoByCode(supabase, params.code)
  if (error) {
    console.error("[newsletter-promo] fetch by code:", error)
    return { ok: false, error: "Could not verify promo code." }
  }
  if (!row) {
    return { ok: false, error: "That promo code is not valid." }
  }
  if (row.redeemed_at) {
    return { ok: false, error: "This promo code has already been used." }
  }
  if (isPromoExpired(row)) {
    return { ok: false, error: "This promo code has expired." }
  }
  if (!emailsMatch(row.email, params.buyerEmail)) {
    return {
      ok: false,
      error: "This code was emailed to a different address. Sign in with that email to use it.",
    }
  }

  const discountPercent = row.discount_percent || NEWSLETTER_PROMO_DISCOUNT_PERCENT
  const { discountUsd, totalUsd } = computeCheckoutTotalWithNewsletterPromo({
    itemSubtotalUsd: params.itemSubtotalUsd,
    shippingUsd: params.shippingUsd,
    discountPercent,
  })

  if (totalUsd < 0.5) {
    return { ok: false, error: "Order total is below the minimum after discount." }
  }

  return {
    ok: true,
    promo: row,
    discountPercent,
    discountUsd,
    totalUsd,
  }
}

export type WelcomePromoForAccountResult =
  | {
      ok: true
      promoCode: string
      discountPercent: number
      expiresAt: string
      /** True when this call created or replaced the code. False when an active code already exists. */
      isNewCode: boolean
    }
  | { ok: false; error: string }

/**
 * Unredeemed codes may be replaced when expired, or when the stored percent is below
 * the current welcome offer (e.g. leftover 10% codes swapping to 15%).
 */
function isEligibleForWelcomePromoReplacement(
  row: NewsletterPromoCodeRow,
  now = new Date(),
): boolean {
  if (row.redeemed_at) return false
  if (isPromoExpired(row, now)) return true
  return row.discount_percent < NEWSLETTER_PROMO_DISCOUNT_PERCENT
}

async function releaseReservationIfAbandoned(
  supabase: SupabaseClient,
  row: NewsletterPromoCodeRow,
): Promise<NewsletterPromoCodeRow | null> {
  if (!row.reserved_payment_intent_id) return row

  try {
    const stripe = getStripe()
    await releaseAbandonedNewsletterPromoReservation(stripe, supabase, row)
  } catch (err) {
    console.warn("[newsletter-promo] could not inspect reservation before replace:", err)
    return null
  }

  const refreshed = await fetchNewsletterPromoForEmail(supabase, row.email)
  if (refreshed.error || !refreshed.row) return null
  if (refreshed.row.redeemed_at || refreshed.row.reserved_payment_intent_id) return null
  return refreshed.row
}

async function insertWelcomePromoCode(
  supabase: SupabaseClient,
  email: string,
  expiresAt: string,
): Promise<{ row: NewsletterPromoCodeRow | null; lastInsertError: string | null; duplicateEmail: boolean }> {
  let lastInsertError: string | null = null

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateNewsletterPromoCode()
    const inserted = await insertNewsletterPromoCode(supabase, {
      email,
      code,
      discountPercent: NEWSLETTER_PROMO_DISCOUNT_PERCENT,
      expiresAt,
    })
    if (inserted.row) {
      return { row: inserted.row, lastInsertError: null, duplicateEmail: false }
    }
    lastInsertError = inserted.error
    if (
      inserted.error &&
      (inserted.error.toLowerCase().includes("duplicate") ||
        inserted.error.includes("newsletter_promo_codes_email_uidx"))
    ) {
      return { row: null, lastInsertError, duplicateEmail: true }
    }
    if (inserted.error && !inserted.error.toLowerCase().includes("duplicate")) {
      break
    }
  }

  return { row: null, lastInsertError, duplicateEmail: false }
}

async function replaceWelcomePromoCode(
  supabase: SupabaseClient,
  promoId: string,
  expiresAt: string,
): Promise<{ row: NewsletterPromoCodeRow | null; lastError: string | null }> {
  let lastError: string | null = null

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateNewsletterPromoCode()
    const replaced = await replaceUnredeemedNewsletterPromoCode(supabase, {
      promoId,
      code,
      discountPercent: NEWSLETTER_PROMO_DISCOUNT_PERCENT,
      expiresAt,
    })
    if (replaced.row) {
      const nudgeClear = await clearNewsletterPromoExpirationNudgesForPromo(supabase, promoId)
      if (nudgeClear.error) {
        console.warn("[newsletter-promo] clear expiration nudges failed:", nudgeClear.error)
      }
      return { row: replaced.row, lastError: null }
    }
    lastError = replaced.error
    if (replaced.error && !replaced.error.toLowerCase().includes("duplicate")) {
      break
    }
  }

  return { row: null, lastError }
}

function welcomePromoFromRow(
  row: NewsletterPromoCodeRow,
  isNewCode: boolean,
): WelcomePromoForAccountResult {
  return {
    ok: true,
    promoCode: row.code,
    discountPercent: row.discount_percent,
    expiresAt: row.expires_at,
    isNewCode,
  }
}

/**
 * Issue the one-time welcome promo for an account email.
 * Call only after the person has a Reswell account — anonymous email capture must not mint a code.
 * One active code per email. Expired or below-offer unredeemed codes are replaced in place.
 * Does not send Klaviyo; the new-account welcome event carries the code.
 */
export async function issueWelcomePromoForAccount(
  email: string,
): Promise<WelcomePromoForAccountResult> {
  const normalizedEmail = normalizeNewsletterPromoEmail(email)
  if (!normalizedEmail) {
    return { ok: false, error: "Account email is required." }
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Promo codes are temporarily unavailable." }
  }

  const existing = await fetchNewsletterPromoForEmail(supabase, normalizedEmail)
  if (existing.error) {
    console.error("[newsletter-promo] fetch for email:", existing.error)
    return { ok: false, error: "Could not issue your promo code." }
  }

  const expiresAt = promoExpiryIso()

  if (existing.row) {
    if (!isEligibleForWelcomePromoReplacement(existing.row)) {
      return welcomePromoFromRow(existing.row, false)
    }

    const releasable = await releaseReservationIfAbandoned(supabase, existing.row)
    if (!releasable || !isEligibleForWelcomePromoReplacement(releasable)) {
      return welcomePromoFromRow(existing.row, false)
    }

    const replaced = await replaceWelcomePromoCode(supabase, releasable.id, expiresAt)
    if (!replaced.row) {
      console.error("[newsletter-promo] replace previous code failed:", replaced.lastError)
      return { ok: false, error: "Could not update your promo code." }
    }
    return welcomePromoFromRow(replaced.row, true)
  }

  const inserted = await insertWelcomePromoCode(supabase, normalizedEmail, expiresAt)
  if (inserted.duplicateEmail) {
    const raced = await fetchNewsletterPromoForEmail(supabase, normalizedEmail)
    if (raced.row && !isEligibleForWelcomePromoReplacement(raced.row)) {
      return welcomePromoFromRow(raced.row, false)
    }
    return { ok: false, error: "Could not issue your promo code." }
  }
  if (!inserted.row) {
    console.error("[newsletter-promo] insert failed:", inserted.lastInsertError)
    return { ok: false, error: "Could not generate your promo code." }
  }
  return welcomePromoFromRow(inserted.row, true)
}
