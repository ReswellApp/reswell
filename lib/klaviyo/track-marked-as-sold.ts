/**
 * Server-only: Klaviyo Events API — fires when a seller marks a listing sold off-platform.
 *
 * **Metric name in Klaviyo:** `marked as sold`
 */

import { absoluteKlaviyoListingPhotoUrl } from "@/lib/klaviyo/catalog-product"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { listingDetailHref } from "@/lib/listing-href"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import {
  SOLD_OFF_PLATFORM_CHANNEL_LABELS,
  type SoldOffPlatformChannel,
} from "@/lib/validations/mark-listing-sold"

export type KlaviyoMarkedAsSoldPayload = {
  sellerUserId: string
  sellerEmail?: string | null
  listingId: string
  title: string
  price: number
  section: string
  slug?: string | null
  photoUrl?: string | null
  channel: SoldOffPlatformChannel
  channelDetail?: string | null
}

function resolveSaleChannelLabel(
  channel: SoldOffPlatformChannel,
  detail?: string | null,
): string {
  if (channel === "elsewhere") {
    const trimmed = typeof detail === "string" ? detail.trim() : ""
    return trimmed || SOLD_OFF_PLATFORM_CHANNEL_LABELS.elsewhere
  }
  return SOLD_OFF_PLATFORM_CHANNEL_LABELS[channel]
}

export async function trackKlaviyoMarkedAsSold(
  payload: KlaviyoMarkedAsSoldPayload,
): Promise<void> {
  const sellerEmail =
    payload.sellerEmail !== undefined
      ? payload.sellerEmail
      : await getAuthEmailForUserId(payload.sellerUserId)

  const priceNum = typeof payload.price === "number" ? payload.price : Number(payload.price)
  const origin = publicSiteOrigin()
  const listingPath = listingDetailHref({
    id: payload.listingId,
    slug: payload.slug ?? undefined,
    section: payload.section,
  })
  const listingUrl = `${origin}${listingPath}`
  const saleChannelLabel = resolveSaleChannelLabel(payload.channel, payload.channelDetail)

  await sendKlaviyoServerEvent({
    metricName: "marked as sold",
    profile: {
      external_id: payload.sellerUserId,
      email: sellerEmail,
    },
    uniqueId: `marked-as-sold-${payload.listingId}`,
    value: Number.isFinite(priceNum) ? priceNum : undefined,
    valueCurrency: "USD",
    properties: {
      listing_id: payload.listingId,
      Title: payload.title,
      Price: Number.isFinite(priceNum) ? priceNum : payload.price,
      listing_url: listingUrl,
      photo_url: payload.photoUrl ? absoluteKlaviyoListingPhotoUrl(payload.photoUrl) : "",
      sold_off_platform: true,
      sale_channel: payload.channel,
      sale_channel_label: saleChannelLabel,
      sale_channel_detail:
        payload.channel === "elsewhere" ? (payload.channelDetail?.trim() ?? "") : "",
    },
  })
}
