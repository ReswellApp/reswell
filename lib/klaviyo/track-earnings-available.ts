/**
 * Server-only: Klaviyo Events API — fires when seller earnings unlock into the wallet.
 *
 * **Metric name in Klaviyo:** `Earnings Available` — use as the flow trigger (Flows → Metric).
 *
 * **Building the flow:** Flows → Create flow → Metric → **Earnings Available** →
 * add email. Filter `reswell_metric_seed` is not true.
 * Template: `lib/klaviyo/earnings-available-email-liquid.ts`.
 *
 * Suggested subject: `Your earnings from {{ event.Title }} are available`
 *
 * Profile on the event is the **seller** (`external_id` + email when available).
 */

import { listingDetailHref } from "@/lib/listing-href"
import {
  isKlaviyoPlaceholderListingPhotoUrl,
  klaviyoEmailListingPhotoUrl,
} from "@/lib/klaviyo/catalog-product"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import type { KlaviyoSellerOrderConfirmedPayload } from "@/lib/klaviyo/track-seller-order-confirmed"

export const EARNINGS_AVAILABLE_METRIC = "Earnings Available"

export type KlaviyoEarningsAvailablePayload = KlaviyoSellerOrderConfirmedPayload

export async function trackKlaviyoEarningsAvailable(
  payload: KlaviyoEarningsAvailablePayload,
): Promise<void> {
  const orderAmountNum =
    typeof payload.orderAmount === "number" ? payload.orderAmount : Number(payload.orderAmount)
  const sellerEarningsNum =
    typeof payload.sellerEarnings === "number"
      ? payload.sellerEarnings
      : Number(payload.sellerEarnings)
  const platformFeeNum =
    typeof payload.platformFee === "number" ? payload.platformFee : Number(payload.platformFee)

  const origin = publicSiteOrigin()
  const listingPath = listingDetailHref({
    id: payload.listingId,
    slug: payload.listingSlug ?? undefined,
    section: payload.listingSection,
  })
  const listingUrl = `${origin}${listingPath}`
  const saleUrl = `${origin}/dashboard/sales/${payload.orderId}`
  const earningsUrl = `${origin}/dashboard/earnings`
  const listingImageUrl = resolveEarningsListingImageUrl(payload.listingImageUrl)

  await sendKlaviyoServerEvent({
    metricName: EARNINGS_AVAILABLE_METRIC,
    profile: {
      external_id: payload.sellerUserId,
      email: payload.sellerEmail,
    },
    uniqueId: `earnings-available-${payload.orderId}`,
    value: Number.isFinite(sellerEarningsNum) ? sellerEarningsNum : undefined,
    valueCurrency: "USD",
    properties: {
      order_id: payload.orderId,
      order_num: formatOrderNumForCustomer(payload.orderNum, payload.orderId),
      listing_id: payload.listingId,
      Title: payload.listingTitle,
      fulfillment_method: payload.fulfillmentMethod,
      payment_method: payload.paymentMethod,
      listing_url: listingUrl,
      listing_image_url: listingImageUrl,
      photo_url: listingImageUrl,
      has_product_image: Boolean(listingImageUrl),
      order_url: saleUrl,
      sale_url: saleUrl,
      earnings_url: earningsUrl,
      order_amount: Number.isFinite(orderAmountNum) ? orderAmountNum : payload.orderAmount,
      seller_earnings: Number.isFinite(sellerEarningsNum) ? sellerEarningsNum : payload.sellerEarnings,
      platform_fee: Number.isFinite(platformFeeNum) ? platformFeeNum : payload.platformFee,
    },
  })
}

function resolveEarningsListingImageUrl(raw: string | null | undefined): string {
  const resolved = klaviyoEmailListingPhotoUrl(raw)
  if (!resolved.trim() || isKlaviyoPlaceholderListingPhotoUrl(resolved)) return ""
  return resolved
}
