/**
 * Klaviyo metric **"Newsletter"** — trigger your welcome email flow with the unique promo code.
 * Template variables: promo_code, discount_percent, expires_at, discount_label.
 */

import { newsletterPromoEventProperties } from "@/lib/klaviyo/newsletter-promo-event-properties"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { publicSiteOrigin } from "@/lib/public-site-origin"

export { newsletterPromoEventProperties } from "@/lib/klaviyo/newsletter-promo-event-properties"

export async function trackKlaviyoNewsletterSignup(input: {
  email: string
  promoCode: string
  discountPercent: number
  expiresAt: string
  isNewCode: boolean
}): Promise<void> {
  const email = input.email.trim()
  if (!email) return

  const result = await sendKlaviyoServerEvent({
    metricName: "Newsletter",
    profile: { email },
    properties: newsletterPromoEventProperties({
      ...input,
      email,
      shopOrigin: publicSiteOrigin(),
    }),
    uniqueId: `newsletter-${email}-${input.promoCode}`,
  })

  if (result.skipped && result.skipReason) {
    console.warn("[klaviyo] Newsletter signup skipped:", result.skipReason)
  } else if (!result.ok) {
    console.error("[klaviyo] Newsletter signup event failed:", result.status, result.detail)
  }
}
