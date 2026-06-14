/**
 * Klaviyo metric **"Newsletter"** — trigger your welcome email flow with the unique promo code.
 * Template variables: promo_code, discount_percent, expires_at, discount_label.
 */

import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { publicSiteOrigin } from "@/lib/public-site-origin"

export async function trackKlaviyoNewsletterSignup(input: {
  email: string
  promoCode: string
  discountPercent: number
  expiresAt: string
  isNewCode: boolean
}): Promise<void> {
  const email = input.email.trim()
  if (!email) return

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

  const result = await sendKlaviyoServerEvent({
    metricName: "Newsletter",
    profile: { email },
    properties: {
      email,
      promo_code: input.promoCode,
      discount_percent: input.discountPercent,
      discount_label: `${input.discountPercent}% off`,
      expires_at: input.expiresAt,
      expires_at_formatted: expiresFormatted,
      shop_url: `${origin}/boards`,
      is_new_code: input.isNewCode,
    },
    uniqueId: `newsletter-${email}-${input.promoCode}`,
  })

  if (result.skipped && result.skipReason) {
    console.warn("[klaviyo] Newsletter signup skipped:", result.skipReason)
  } else if (!result.ok) {
    console.error("[klaviyo] Newsletter signup event failed:", result.status, result.detail)
  }
}
