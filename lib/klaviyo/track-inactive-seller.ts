/**
 * Klaviyo Events API — **Inactive Seller** when a seller has not replied to buyer
 * listing messages for 7+ days. Cron applies vacation mode before emitting this event.
 *
 * **Metric (Flows → Metric → …):** **Inactive Seller**
 *
 * **Profile = seller** so flows email the listing owner about missed messages.
 *
 * Bootstrap: `POST /api/integrations/klaviyo/bootstrap-inactive-seller-metric`
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
import { SELLER_MESSAGE_INACTIVITY_DAYS } from "@/lib/db/sellerMessageInactivity"

const MESSAGE_PROP_MAX = 2000

export const INACTIVE_SELLER_METRIC = "Inactive Seller"

export type KlaviyoInactiveSellerMissedMessage = {
  conversation_id: string
  message_id: string
  buyer_user_id: string
  buyer_message_at: string
  message: string
  messages_url: string
}

export type TrackKlaviyoInactiveSellerPayload = {
  sellerUserId: string
  sellerEmail?: string | null
  sellerDisplayName?: string | null
  listingId: string
  listingTitle: string
  listingSlug: string | null
  listingSection: string
  listingImages?: KlaviyoListingImage[] | null
  vacationModeApplied: boolean
  missedMessages: KlaviyoInactiveSellerMissedMessage[]
  uniqueIdSuffix?: string
}

function truncateMessage(content: string): string {
  const trimmed = content.trim()
  if (trimmed.length <= MESSAGE_PROP_MAX) return trimmed
  return `${trimmed.slice(0, MESSAGE_PROP_MAX)}…`
}

function buildMissedMessagesPlain(
  missed: KlaviyoInactiveSellerMissedMessage[],
): string {
  if (missed.length === 0) return ""
  return missed
    .map((m, i) => {
      const at = m.buyer_message_at.slice(0, 10)
      return `${i + 1}. (${at}) ${m.message}\n   Reply: ${m.messages_url}`
    })
    .join("\n\n")
}

export async function trackKlaviyoInactiveSeller(
  payload: TrackKlaviyoInactiveSellerPayload,
): Promise<Awaited<ReturnType<typeof sendKlaviyoServerEvent>>> {
  const eventTime = new Date().toISOString()
  const origin = publicSiteOriginForEmail().replace(/\/$/, "")

  let sellerEmail = payload.sellerEmail?.trim() || null
  if (!sellerEmail) {
    sellerEmail = await getAuthEmailForUserId(payload.sellerUserId)
  }

  const listingPath = listingDetailHref({
    id: payload.listingId,
    slug: payload.listingSlug ?? undefined,
    section: payload.listingSection,
  })
  const listingUrl = `${origin}${listingPath}`
  const messagesInboxUrl = `${origin}/messages`

  const missed = payload.missedMessages.map((m) => ({
    ...m,
    message: truncateMessage(m.message),
  }))

  const photoUrl = absoluteKlaviyoListingImageUrl({
    id: payload.listingId,
    slug: payload.listingSlug,
    title: payload.listingTitle,
    section: payload.listingSection,
    listing_images: payload.listingImages ?? null,
  })

  const messageIds = missed.map((m) => m.message_id).sort().join("-")
  const baseId = `inactive-seller-${SELLER_MESSAGE_INACTIVITY_DAYS}d-${payload.listingId}-${messageIds}`
  const suffix =
    typeof payload.uniqueIdSuffix === "string" && payload.uniqueIdSuffix.trim()
      ? `-${payload.uniqueIdSuffix.trim()}`
      : ""

  return sendKlaviyoServerEvent({
    metricName: INACTIVE_SELLER_METRIC,
    profile: {
      external_id: payload.sellerUserId,
      email: sellerEmail,
    },
    uniqueId: `${baseId}${suffix}`,
    properties: {
      time: eventTime,
      days_unanswered: SELLER_MESSAGE_INACTIVITY_DAYS,
      vacation_mode_applied: payload.vacationModeApplied,
      seller_user_id: payload.sellerUserId,
      seller_display_name: payload.sellerDisplayName?.trim() ?? "",
      listing_id: payload.listingId,
      Title: payload.listingTitle,
      listing_title: payload.listingTitle,
      listing_url: listingUrl,
      photo_url: photoUrl,
      messages_url: messagesInboxUrl,
      missed_message_count: missed.length,
      missed_messages: missed,
      missed_messages_plain: buildMissedMessagesPlain(missed),
    },
  })
}
