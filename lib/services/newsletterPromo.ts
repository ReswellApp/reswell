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
  type NewsletterPromoCodeRow,
} from "@/lib/db/newsletterPromoCodes"
import { trackKlaviyoNewsletterSignup } from "@/lib/klaviyo/track-newsletter-signup"
import { subscribeKlaviyoProfileEmailMarketing } from "@/lib/klaviyo/subscribe-profile-email-marketing"
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

const ABANDONED_PROMO_PI_STATUSES = new Set<Stripe.PaymentIntent.Status>([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "canceled",
])

/**
 * Cancels an abandoned checkout PaymentIntent and clears its promo reservation so a new
 * intent can be created (e.g. after shipping address changes or React remounts checkout).
 * Leaves reservations tied to succeeded/processing intents untouched.
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
    if (!ABANDONED_PROMO_PI_STATUSES.has(existingPi.status)) {
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

export type CreateNewsletterPromoSignupResult =
  | { ok: true }
  | { ok: false; error: string; alreadySignedUp?: boolean }

/**
 * Subscribe visitor email, issue a one-time promo code, fire Klaviyo **Newsletter** metric.
 * Each email may only enter this flow once (lifetime).
 */
export async function createNewsletterPromoSignup(email: string): Promise<CreateNewsletterPromoSignupResult> {
  const normalizedEmail = normalizeNewsletterPromoEmail(email)

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Signup is temporarily unavailable." }
  }

  const existing = await fetchNewsletterPromoForEmail(supabase, normalizedEmail)
  if (existing.error) {
    console.error("[newsletter-promo] fetch for email:", existing.error)
    return { ok: false, error: "Could not complete signup." }
  }

  if (existing.row) {
    return {
      ok: false,
      alreadySignedUp: true,
      error: "This email already signed up. Check your inbox for your code.",
    }
  }

  const expiresAt = promoExpiryIso()
  let codeRow: NewsletterPromoCodeRow | null = null
  let lastInsertError: string | null = null

  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateNewsletterPromoCode()
    const inserted = await insertNewsletterPromoCode(supabase, {
      email: normalizedEmail,
      code,
      discountPercent: NEWSLETTER_PROMO_DISCOUNT_PERCENT,
      expiresAt,
    })
    if (inserted.row) {
      codeRow = inserted.row
      break
    }
    lastInsertError = inserted.error
    if (
      inserted.error &&
      (inserted.error.toLowerCase().includes("duplicate") ||
        inserted.error.includes("newsletter_promo_codes_email_uidx"))
    ) {
      return {
        ok: false,
        alreadySignedUp: true,
        error: "This email already signed up. Check your inbox for your code.",
      }
    }
    if (inserted.error && !inserted.error.toLowerCase().includes("duplicate")) {
      break
    }
  }

  if (!codeRow) {
    console.error("[newsletter-promo] insert failed:", lastInsertError)
    return { ok: false, error: "Could not generate your promo code. Try again." }
  }

  await subscribeKlaviyoProfileEmailMarketing({ email: normalizedEmail })

  await trackKlaviyoNewsletterSignup({
    email: normalizedEmail,
    promoCode: codeRow.code,
    discountPercent: codeRow.discount_percent,
    expiresAt: codeRow.expires_at,
    isNewCode: true,
  })

  return { ok: true }
}
