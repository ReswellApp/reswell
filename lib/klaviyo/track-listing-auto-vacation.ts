/**
 * Server-only: Klaviyo **Listing Auto Vacation** when a live listing is hidden
 * because the seller has been inactive (`seller_inactivity` /
 * "Auto vacation (inactive seller)" in `/admin/listings/hidden`).
 *
 * **Metric name in Klaviyo:** `Listing Auto Vacation` — use as the flow trigger
 * (Flows → Create flow → Metric). Profile is the **seller**.
 *
 * **Building the flow in Klaviyo:**
 * 1. Flows → Create flow → Metric → **Listing Auto Vacation**.
 * 2. Trigger filter: `reswell_metric_seed` is not true (ignore bootstrap).
 * 3. CTA: `{{ event.manage_url }}` (dashboard listings) or `{{ event.edit_url }}`.
 *    Also available: `Title`, `Price`, `price_display`, `photo_url`, `listing_url`,
 *    `hide_reason_label`, `days_unanswered`.
 *
 * Fires from `setListingVacationModeForSeller` only on a hide transition with
 * source `seller_inactivity` (the seller-message inactivity cron).
 *
 * Bootstrap: `POST /api/integrations/klaviyo/bootstrap-listing-auto-vacation-metric`
 * Cron: `GET /api/cron/seller-message-inactivity`
 */

import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import {
  absoluteKlaviyoListingImageUrl,
  formatKlaviyoPriceDisplay,
  parseKlaviyoListingPrice,
  type KlaviyoListingImage,
} from "@/lib/klaviyo/catalog-product"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { SELLER_MESSAGE_INACTIVITY_DAYS } from "@/lib/db/sellerMessageInactivity"
import { listingVisibilitySourceLabel } from "@/lib/listing-visibility-sources"
import { listingDetailHref } from "@/lib/listing-href"
import {
  isPeerListingSection,
  PEER_LISTING_SECTION_LABELS,
  peerListingEditHref,
} from "@/lib/peer-listing-sections"
import { publicSiteOriginForEmail } from "@/lib/public-site-origin"

export const LISTING_AUTO_VACATION_METRIC = "Listing Auto Vacation"

export const LISTING_AUTO_VACATION_HIDE_REASON = "seller_inactivity" as const

export type TrackKlaviyoListingAutoVacationPayload = {
  sellerUserId: string
  sellerEmail?: string | null
  listingId: string
  listingTitle: string
  listingSlug?: string | null
  listingSection: string
  price?: string | number | null
  listingImages?: KlaviyoListingImage[] | null
  uniqueIdSuffix?: string
}

function sectionLabel(section: string | null | undefined): string {
  if (isPeerListingSection(section)) return PEER_LISTING_SECTION_LABELS[section]
  return section?.trim() || "Listing"
}

export async function trackKlaviyoListingAutoVacation(
  payload: TrackKlaviyoListingAutoVacationPayload,
): Promise<Awaited<ReturnType<typeof sendKlaviyoServerEvent>>> {
  const eventTime = new Date().toISOString()
  const origin = publicSiteOriginForEmail().replace(/\/$/, "")

  let sellerEmail = payload.sellerEmail?.trim() || null
  if (!sellerEmail) {
    sellerEmail = await getAuthEmailForUserId(payload.sellerUserId)
  }

  const title = payload.listingTitle.trim() || "Your listing"
  const price = parseKlaviyoListingPrice(payload.price)
  const listingPath = listingDetailHref({
    id: payload.listingId,
    slug: payload.listingSlug ?? undefined,
    section: payload.listingSection,
  })
  const listingUrl = `${origin}${listingPath}`
  const manageUrl = `${origin}/dashboard/listings`
  const editUrl = `${origin}${peerListingEditHref(payload.listingSection, payload.listingId)}`
  const photoUrl = absoluteKlaviyoListingImageUrl({
    id: payload.listingId,
    slug: payload.listingSlug,
    title,
    section: payload.listingSection,
    listing_images: payload.listingImages ?? null,
  })

  const suffix =
    typeof payload.uniqueIdSuffix === "string" && payload.uniqueIdSuffix.trim()
      ? `-${payload.uniqueIdSuffix.trim()}`
      : ""

  return sendKlaviyoServerEvent({
    metricName: LISTING_AUTO_VACATION_METRIC,
    profile: {
      external_id: payload.sellerUserId,
      email: sellerEmail,
    },
    uniqueId: `listing-auto-vacation-${payload.listingId}-${eventTime.slice(0, 10)}${suffix}`,
    value: price ?? undefined,
    valueCurrency: price != null ? "USD" : undefined,
    properties: {
      time: eventTime,
      hide_reason: LISTING_AUTO_VACATION_HIDE_REASON,
      hide_reason_label: listingVisibilitySourceLabel(LISTING_AUTO_VACATION_HIDE_REASON),
      days_unanswered: SELLER_MESSAGE_INACTIVITY_DAYS,
      seller_user_id: payload.sellerUserId,
      listing_id: payload.listingId,
      Title: title,
      listing_title: title,
      Price: price ?? 0,
      price_display: formatKlaviyoPriceDisplay(price),
      photo_url: photoUrl,
      listing_url: listingUrl,
      manage_url: manageUrl,
      edit_url: editUrl,
      section: payload.listingSection ?? "",
      section_label: sectionLabel(payload.listingSection),
    },
  })
}
