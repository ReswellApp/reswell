/**
 * Klaviyo metric **"Newsletter Promo Expiring"** — reminder 3 days before an unredeemed
 * newsletter promo expires. Fired after the code is bumped to 15% off (same code string).
 *
 * Template variables: promo_code, discount_percent, discount_label, expires_at,
 * previous_discount_percent, discount_bumped, shop_url.
 */

import { NEWSLETTER_PROMO_EXPIRATION_NUDGE_DAYS_BEFORE } from "@/lib/constants/newsletter-promo"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { publicSiteOrigin } from "@/lib/public-site-origin"

export const NEWSLETTER_PROMO_EXPIRING_METRIC = "Newsletter Promo Expiring"

export async function trackKlaviyoNewsletterPromoExpiring(input: {
  email: string
  promoCode: string
  discountPercent: number
  previousDiscountPercent: number
  expiresAt: string
  promoId: string
}): Promise<Awaited<ReturnType<typeof sendKlaviyoServerEvent>>> {
  const email = input.email.trim()
  if (!email) {
    return {
      ok: false,
      status: 0,
      skipped: true,
      skipReason: "missing_email",
      detail: "Email is required for Newsletter Promo Expiring.",
    }
  }

  const origin = publicSiteOrigin()
  const expiresDate = new Date(input.expiresAt)
  const expiresFormatted = Number.isFinite(expiresDate.getTime())
    ? expiresDate.toLocaleDateString("en-US", {
        month: "long",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      })
    : input.expiresAt

  const discountBumped = input.discountPercent > input.previousDiscountPercent

  return sendKlaviyoServerEvent({
    metricName: NEWSLETTER_PROMO_EXPIRING_METRIC,
    profile: { email },
    properties: {
      email,
      promo_code: input.promoCode,
      discount_percent: input.discountPercent,
      previous_discount_percent: input.previousDiscountPercent,
      discount_label: `${input.discountPercent}% off`,
      discount_bumped: discountBumped,
      expires_at: input.expiresAt,
      expires_at_formatted: expiresFormatted,
      days_until_expiry: NEWSLETTER_PROMO_EXPIRATION_NUDGE_DAYS_BEFORE,
      shop_url: `${origin}/boards`,
    },
    uniqueId: `newsletter-promo-expiring-${input.promoId}`,
  })
}
