/**
 * Sends one seed event each so **Seller Still Here** and **Seller Listing Hide Warning**
 * appear under Flows → Your metrics → API before a real seller qualifies.
 */

import "@/lib/klaviyo/bootstrap-env"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import {
  SELLER_LISTING_HIDE_WARNING_METRIC,
  SELLER_STILL_HERE_METRIC,
} from "@/lib/klaviyo/track-seller-message-reminder"
import {
  SELLER_MESSAGE_INACTIVITY_DAYS,
  SELLER_MESSAGE_REMINDER_DAYS,
  SELLER_MESSAGE_WARNING_DAYS,
} from "@/lib/db/sellerMessageInactivity"

const SEED_PROFILE_EXTERNAL_ID = "reswell-metric-seed-seller-message-reminder"

export type BootstrapSellerMessageReminderMetricResult = {
  metric_name: string
  ok: boolean
  skipped: boolean
  status: number
  skipReason?: string
  detail: string
}

async function seedMetric(input: {
  metricName: string
  uniqueId: string
  daysUnanswered: number
  daysUntilHidden: number
  emailHeadline: string
  emailBody: string
}): Promise<BootstrapSellerMessageReminderMetricResult> {
  const time = new Date().toISOString()
  const r = await sendKlaviyoServerEvent({
    metricName: input.metricName,
    profile: { external_id: SEED_PROFILE_EXTERNAL_ID },
    uniqueId: input.uniqueId,
    properties: {
      time,
      reswell_metric_seed: true,
      days_unanswered: input.daysUnanswered,
      days_until_hidden: input.daysUntilHidden,
      hide_after_days: SELLER_MESSAGE_INACTIVITY_DAYS,
      email_headline: input.emailHeadline,
      email_body: input.emailBody,
      Title: "Seller message reminder (metric seed)",
      messages_url: "https://www.reswell.app/messages",
      manage_url: "https://www.reswell.app/dashboard/listings",
    },
  })

  return {
    metric_name: input.metricName,
    ok: r.ok,
    skipped: r.skipped,
    status: r.status,
    skipReason: r.skipReason,
    detail: r.detail,
  }
}

export async function bootstrapSellerMessageReminderMetrics(): Promise<{
  results: BootstrapSellerMessageReminderMetricResult[]
}> {
  const stillHere = await seedMetric({
    metricName: SELLER_STILL_HERE_METRIC,
    uniqueId: "reswell-seed-seller-still-here",
    daysUnanswered: SELLER_MESSAGE_REMINDER_DAYS,
    daysUntilHidden: SELLER_MESSAGE_INACTIVITY_DAYS - SELLER_MESSAGE_REMINDER_DAYS,
    emailHeadline: "Still here?",
    emailBody: "Someone is waiting for a response on your listing.",
  })
  const hideWarning = await seedMetric({
    metricName: SELLER_LISTING_HIDE_WARNING_METRIC,
    uniqueId: "reswell-seed-seller-listing-hide-warning",
    daysUnanswered: SELLER_MESSAGE_WARNING_DAYS,
    daysUntilHidden: SELLER_MESSAGE_INACTIVITY_DAYS - SELLER_MESSAGE_WARNING_DAYS,
    emailHeadline: "Still have this listing?",
    emailBody:
      "Your listing will be hidden if there's no response. Just checking in to see if you still have it.",
  })

  return { results: [stillHere, hideWarning] }
}
