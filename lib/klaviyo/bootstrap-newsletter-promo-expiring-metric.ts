/**
 * Sends one minimal Events API event so **Newsletter Promo Expiring** appears under
 * **Flows → Your metrics → API** before any real promo qualifies for cron.
 */

import "@/lib/klaviyo/bootstrap-env"
import { NEWSLETTER_PROMO_EXPIRATION_NUDGE_DAYS_BEFORE } from "@/lib/constants/newsletter-promo"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { NEWSLETTER_PROMO_EXPIRING_METRIC } from "@/lib/klaviyo/track-newsletter-promo-expiring"

const SEED_PROFILE_EXTERNAL_ID = "reswell-metric-seed-newsletter-promo-expiring"

export type BootstrapNewsletterPromoExpiringMetricResult = {
  metric_name: string
  ok: boolean
  skipped: boolean
  status: number
  skipReason?: string
  detail: string
}

export async function bootstrapNewsletterPromoExpiringMetric(): Promise<{
  result: BootstrapNewsletterPromoExpiringMetricResult
}> {
  const time = new Date().toISOString()
  const r = await sendKlaviyoServerEvent({
    metricName: NEWSLETTER_PROMO_EXPIRING_METRIC,
    profile: {
      external_id: SEED_PROFILE_EXTERNAL_ID,
    },
    uniqueId: "reswell-seed-newsletter-promo-expiring",
    properties: {
      time,
      reswell_metric_seed: true,
      promo_code: "WELCOME-SEED00",
      discount_percent: 15,
      previous_discount_percent: 10,
      discount_label: "15% off",
      discount_bumped: true,
      days_until_expiry: NEWSLETTER_PROMO_EXPIRATION_NUDGE_DAYS_BEFORE,
    },
  })

  return {
    result: {
      metric_name: NEWSLETTER_PROMO_EXPIRING_METRIC,
      ok: r.ok,
      skipped: r.skipped,
      status: r.status,
      skipReason: r.skipReason,
      detail: r.detail,
    },
  }
}
