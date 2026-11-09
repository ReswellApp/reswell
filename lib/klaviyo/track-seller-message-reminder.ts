/**
 * Server-only Klaviyo reminders before a listing is auto-hidden.
 *
 * **Day 3 metric:** `Seller Still Here`
 * Flow copy: "Still here? Someone is waiting for a response on your listing."
 *
 * **Day 6 metric:** `Seller Listing Hide Warning`
 * Flow copy: the listing goes into vacation mode (hidden) if there's no response.
 * The seller can turn it back on whenever they like.
 *
 * Profile is the seller. Ignore events where `reswell_metric_seed` is true.
 * Use `email_headline`, `email_body`, `messages_url`, `Title`, and `photo_url`
 * in the flow template.
 *
 * Day 7 stays on **Inactive Seller** and **Listing Auto Vacation**.
 *
 * Bootstrap: `POST /api/integrations/klaviyo/bootstrap-seller-message-reminder-metrics`
 * Cron: `GET /api/cron/seller-message-inactivity`
 */

import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import {
  absoluteKlaviyoListingImageUrl,
  type KlaviyoListingImage,
} from "@/lib/klaviyo/catalog-product"
import { listingDetailHref } from "@/lib/listing-href"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import {
  SELLER_MESSAGE_INACTIVITY_DAYS,
  SELLER_MESSAGE_REMINDER_DAYS,
  SELLER_MESSAGE_WARNING_DAYS,
} from "@/lib/db/sellerMessageInactivity"
import type { KlaviyoInactiveSellerMissedMessage } from "@/lib/klaviyo/track-inactive-seller"

const MESSAGE_PROP_MAX = 2000

export const SELLER_STILL_HERE_METRIC = "Seller Still Here"
export const SELLER_LISTING_HIDE_WARNING_METRIC = "Seller Listing Hide Warning"

export type SellerMessageReminderKlaviyoStage = "day3" | "day6"

export type TrackKlaviyoSellerMessageReminderPayload = {
  stage: SellerMessageReminderKlaviyoStage
  sellerUserId: string
  sellerEmail?: string | null
  sellerDisplayName?: string | null
  listingId: string
  listingTitle: string
  listingSlug: string | null
  listingSection: string
  listingImages?: KlaviyoListingImage[] | null
  missedMessages: KlaviyoInactiveSellerMissedMessage[]
}

function truncateMessage(content: string): string {
  const trimmed = content.trim()
  if (trimmed.length <= MESSAGE_PROP_MAX) return trimmed
  return `${trimmed.slice(0, MESSAGE_PROP_MAX)}…`
}

function buildMissedMessagesPlain(missed: KlaviyoInactiveSellerMissedMessage[]): string {
  if (missed.length === 0) return ""
  return missed
    .map((m, i) => {
      const at = m.buyer_message_at.slice(0, 10)
      return `${i + 1}. (${at}) ${m.message}\n   Reply: ${m.messages_url}`
    })
    .join("\n\n")
}

function stageCopy(stage: SellerMessageReminderKlaviyoStage): {
  metricName: string
  daysUnanswered: number
  daysUntilHidden: number
  emailHeadline: string
  emailBody: string
  uniquePrefix: string
} {
  if (stage === "day3") {
    return {
      metricName: SELLER_STILL_HERE_METRIC,
      daysUnanswered: SELLER_MESSAGE_REMINDER_DAYS,
      daysUntilHidden: SELLER_MESSAGE_INACTIVITY_DAYS - SELLER_MESSAGE_REMINDER_DAYS,
      emailHeadline: "Still here?",
      emailBody: "Someone is waiting for a response on your listing.",
      uniquePrefix: "seller-still-here",
    }
  }
  return {
    metricName: SELLER_LISTING_HIDE_WARNING_METRIC,
    daysUnanswered: SELLER_MESSAGE_WARNING_DAYS,
    daysUntilHidden: SELLER_MESSAGE_INACTIVITY_DAYS - SELLER_MESSAGE_WARNING_DAYS,
    emailHeadline: "Still have this listing?",
    emailBody:
      "If there's no response, your listing goes into vacation mode (hidden). You can turn it back on whenever you like.",
    uniquePrefix: "seller-listing-hide-warning",
  }
}

export async function trackKlaviyoSellerMessageReminder(
  payload: TrackKlaviyoSellerMessageReminderPayload,
): Promise<Awaited<ReturnType<typeof sendKlaviyoServerEvent>>> {
  const eventTime = new Date().toISOString()
  const origin = publicSiteOriginForEmail().replace(/\/$/, "")
  const copy = stageCopy(payload.stage)

  let sellerEmail = payload.sellerEmail?.trim() || null
  if (!sellerEmail) {
    sellerEmail = await getAuthEmailForUserId(payload.sellerUserId)
  }

  const title = payload.listingTitle.trim() || "Your listing"
  const listingPath = listingDetailHref({
    id: payload.listingId,
    slug: payload.listingSlug ?? undefined,
    section: payload.listingSection,
  })
  const listingUrl = `${origin}${listingPath}`
  const messagesInboxUrl = `${origin}/messages`
  const manageUrl = `${origin}/dashboard/listings`

  const missed = payload.missedMessages.map((m) => ({
    ...m,
    message: truncateMessage(m.message),
  }))
  const messageIds = missed.map((m) => m.message_id).sort().join("-")

  const photoUrl = absoluteKlaviyoListingImageUrl({
    id: payload.listingId,
    slug: payload.listingSlug,
    title,
    section: payload.listingSection,
    listing_images: payload.listingImages ?? null,
  })

  return sendKlaviyoServerEvent({
    metricName: copy.metricName,
    profile: {
      external_id: payload.sellerUserId,
      email: sellerEmail,
    },
    uniqueId: `${copy.uniquePrefix}-${payload.listingId}-${messageIds}`,
    properties: {
      time: eventTime,
      stage: payload.stage,
      days_unanswered: copy.daysUnanswered,
      days_until_hidden: copy.daysUntilHidden,
      hide_after_days: SELLER_MESSAGE_INACTIVITY_DAYS,
      email_headline: copy.emailHeadline,
      email_body: copy.emailBody,
      seller_user_id: payload.sellerUserId,
      seller_display_name: payload.sellerDisplayName?.trim() ?? "",
      listing_id: payload.listingId,
      Title: title,
      listing_title: title,
      listing_url: listingUrl,
      photo_url: photoUrl,
      messages_url: messagesInboxUrl,
      manage_url: manageUrl,
      missed_message_count: missed.length,
      missed_messages: missed,
      missed_messages_plain: buildMissedMessagesPlain(missed),
    },
  })
}
