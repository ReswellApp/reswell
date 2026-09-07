/**
 * Server-only: Klaviyo Events API — fires when a seller answers the post-sale survey.
 *
 * **Metric name in Klaviyo:** `sold sale feedback`
 */

import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import {
  SOLD_OFF_PLATFORM_CHANNEL_LABELS,
  type SoldOffPlatformChannel,
} from "@/lib/validations/mark-listing-sold"

export type KlaviyoSoldSaleFeedbackPayload = {
  sellerUserId: string
  sellerEmail?: string | null
  listingId: string
  title: string
  price: number
  section: string
  slug?: string | null
  channel?: SoldOffPlatformChannel | null
  channelDetail?: string | null
  reswellHelpedFindBuyer?: boolean | null
}

function resolveSaleChannelLabel(
  channel?: SoldOffPlatformChannel | null,
  detail?: string | null,
): string {
  if (!channel) return "Unspecified"
  if (channel === "elsewhere") {
    const trimmed = typeof detail === "string" ? detail.trim() : ""
    return trimmed || SOLD_OFF_PLATFORM_CHANNEL_LABELS.elsewhere
  }
  return SOLD_OFF_PLATFORM_CHANNEL_LABELS[channel]
}

export async function trackKlaviyoSoldSaleFeedback(
  payload: KlaviyoSoldSaleFeedbackPayload,
): Promise<void> {
  const sellerEmail =
    payload.sellerEmail !== undefined
      ? payload.sellerEmail
      : await getAuthEmailForUserId(payload.sellerUserId)

  const priceNum = typeof payload.price === "number" ? payload.price : Number(payload.price)

  await sendKlaviyoServerEvent({
    metricName: "sold sale feedback",
    profile: {
      external_id: payload.sellerUserId,
      email: sellerEmail,
    },
    uniqueId: `sold-sale-feedback-${payload.listingId}-${payload.channel ?? "na"}-${
      payload.reswellHelpedFindBuyer === true
        ? "yes"
        : payload.reswellHelpedFindBuyer === false
          ? "no"
          : "na"
    }`,
    value: Number.isFinite(priceNum) ? priceNum : undefined,
    valueCurrency: "USD",
    properties: {
      listing_id: payload.listingId,
      Title: payload.title,
      Price: Number.isFinite(priceNum) ? priceNum : payload.price,
      sale_channel: payload.channel ?? "unspecified",
      sale_channel_label: resolveSaleChannelLabel(payload.channel, payload.channelDetail),
      sale_channel_detail:
        payload.channel === "elsewhere" ? (payload.channelDetail?.trim() ?? "") : "",
      reswell_helped_find_buyer:
        typeof payload.reswellHelpedFindBuyer === "boolean"
          ? payload.reswellHelpedFindBuyer
          : "",
    },
  })
}
