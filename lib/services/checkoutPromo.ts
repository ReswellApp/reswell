import type { SupabaseClient } from "@supabase/supabase-js"
import type Stripe from "stripe"
import type { AdminIssuedPromoCodeRow } from "@/lib/db/adminIssuedPromoCodes"
import {
  clearAdminIssuedPromoReservation,
  fetchAdminIssuedPromoByCode,
  redeemAdminIssuedPromoForOrder,
  reserveAdminIssuedPromoForPaymentIntent,
} from "@/lib/db/adminIssuedPromoCodes"
import {
  clearNewsletterPromoReservation,
  fetchNewsletterPromoByCode,
  redeemNewsletterPromoForOrder,
  reserveNewsletterPromoForPaymentIntent,
  type NewsletterPromoCodeRow,
} from "@/lib/db/newsletterPromoCodes"
import { validateAdminIssuedPromoForCheckout } from "@/lib/services/adminIssuedPromo"
import { validateNewsletterPromoForCheckout } from "@/lib/services/newsletterPromo"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { isAdminIssuedPromoCodePrefix } from "@/lib/utils/admin-issued-promo-code"
import { normalizeNewsletterPromoCodeInput } from "@/lib/utils/newsletter-promo-code"

export type CheckoutPromoKind = "newsletter" | "admin_issued"

export type CheckoutPromoRef =
  | { kind: "newsletter"; promo: NewsletterPromoCodeRow }
  | { kind: "admin_issued"; promo: AdminIssuedPromoCodeRow }

export type CheckoutPromoValidationResult =
  | {
      ok: true
      kind: "newsletter"
      promo: NewsletterPromoCodeRow
      discountPercent: number
      discountUsd: number
      totalUsd: number
    }
  | {
      ok: true
      kind: "admin_issued"
      promo: AdminIssuedPromoCodeRow
      discountPercent: number
      discountUsd: number
      totalUsd: number
    }
  | { ok: false; error: string }

const ABANDONED_PROMO_PI_STATUSES = new Set<Stripe.PaymentIntent.Status>([
  "requires_payment_method",
  "requires_confirmation",
  "requires_action",
  "canceled",
])

export async function validateCheckoutPromoForCheckout(params: {
  code: string
  buyerEmail: string
  itemSubtotalUsd: number
  shippingUsd: number
}): Promise<CheckoutPromoValidationResult> {
  const normalized = normalizeNewsletterPromoCodeInput(params.code)

  if (isAdminIssuedPromoCodePrefix(normalized)) {
    const adminResult = await validateAdminIssuedPromoForCheckout({
      code: normalized,
      itemSubtotalUsd: params.itemSubtotalUsd,
      shippingUsd: params.shippingUsd,
    })
    if (!adminResult.ok) return adminResult
    return {
      ok: true,
      kind: "admin_issued",
      promo: adminResult.promo,
      discountPercent: adminResult.discountPercent,
      discountUsd: adminResult.discountUsd,
      totalUsd: adminResult.totalUsd,
    }
  }

  const newsletterResult = await validateNewsletterPromoForCheckout({
    code: normalized,
    buyerEmail: params.buyerEmail,
    itemSubtotalUsd: params.itemSubtotalUsd,
    shippingUsd: params.shippingUsd,
  })
  if (!newsletterResult.ok) return newsletterResult
  return {
    ok: true,
    kind: "newsletter",
    promo: newsletterResult.promo,
    discountPercent: newsletterResult.discountPercent,
    discountUsd: newsletterResult.discountUsd,
    totalUsd: newsletterResult.totalUsd,
  }
}

export async function releaseAbandonedCheckoutPromoReservation(
  stripe: Stripe,
  supabase: SupabaseClient,
  ref: CheckoutPromoRef,
): Promise<void> {
  const reservedPiId = ref.promo.reserved_payment_intent_id?.trim()
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
        console.warn("[checkout-promo] cancel abandoned PI failed:", reservedPiId, err)
      })
    }
    if (ref.kind === "newsletter") {
      await clearNewsletterPromoReservation(supabase, ref.promo.id, reservedPiId)
    } else {
      await clearAdminIssuedPromoReservation(supabase, ref.promo.id, reservedPiId)
    }
  } catch (err) {
    console.warn("[checkout-promo] retrieve abandoned PI failed:", reservedPiId, err)
    if (ref.kind === "newsletter") {
      await clearNewsletterPromoReservation(supabase, ref.promo.id, reservedPiId)
    } else {
      await clearAdminIssuedPromoReservation(supabase, ref.promo.id, reservedPiId)
    }
  }
}

export async function reserveCheckoutPromoForPaymentIntent(
  supabase: SupabaseClient,
  ref: CheckoutPromoRef,
  paymentIntentId: string,
): Promise<{ ok: boolean; error: string | null }> {
  if (ref.kind === "newsletter") {
    return reserveNewsletterPromoForPaymentIntent(supabase, ref.promo.id, paymentIntentId)
  }
  return reserveAdminIssuedPromoForPaymentIntent(supabase, ref.promo.id, paymentIntentId)
}

export async function redeemCheckoutPromoForOrder(
  supabase: SupabaseClient,
  input: {
    kind: CheckoutPromoKind
    promoId: string
    buyerId: string
    orderId: string
    paymentIntentId: string | null
  },
): Promise<{ ok: boolean; error: string | null }> {
  if (input.kind === "newsletter") {
    return redeemNewsletterPromoForOrder(supabase, {
      promoId: input.promoId,
      buyerId: input.buyerId,
      orderId: input.orderId,
      paymentIntentId: input.paymentIntentId,
    })
  }
  return redeemAdminIssuedPromoForOrder(supabase, {
    promoId: input.promoId,
    buyerId: input.buyerId,
    orderId: input.orderId,
    paymentIntentId: input.paymentIntentId,
  })
}

export function parseCheckoutPromoKind(raw: string | null | undefined): CheckoutPromoKind | null {
  const v = raw?.trim()
  if (v === "newsletter" || v === "admin_issued") return v
  return null
}

export async function inferCheckoutPromoKind(
  promoId: string,
): Promise<CheckoutPromoKind | null> {
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return null
  }

  const [admin, newsletter] = await Promise.all([
    supabase.from("admin_issued_promo_codes").select("id").eq("id", promoId).maybeSingle(),
    supabase.from("newsletter_promo_codes").select("id").eq("id", promoId).maybeSingle(),
  ])

  if (admin.data?.id) return "admin_issued"
  if (newsletter.data?.id) return "newsletter"
  return null
}

export async function fetchCheckoutPromoRefByCode(
  code: string,
): Promise<CheckoutPromoRef | null> {
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch {
    return null
  }

  const normalized = normalizeNewsletterPromoCodeInput(code)
  if (isAdminIssuedPromoCodePrefix(normalized)) {
    const { row } = await fetchAdminIssuedPromoByCode(supabase, normalized)
    return row ? { kind: "admin_issued", promo: row } : null
  }

  const { row } = await fetchNewsletterPromoByCode(supabase, normalized)
  return row ? { kind: "newsletter", promo: row } : null
}
