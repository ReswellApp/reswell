/**
 * Server-only: Klaviyo Events API — seller new **local pickup** order at checkout.
 *
 * **Metric name in Klaviyo:** `Local Pickup Sale Received` — profile is the **seller**.
 *
 * Template variables: `pickup_instructions`, `sale_url`, `buyer_display_name`,
 * `{{ event.order_num }}`, `{{ event.Title }}`.
 */

import { listingDetailHref } from "@/lib/listing-href"
import { sellerLocalPickupInstructions } from "@/lib/klaviyo/seller-sale-event-helpers"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import type { KlaviyoSellerNewSaleReceivedPayload } from "@/lib/klaviyo/track-seller-new-sale-received"

export async function trackKlaviyoSellerLocalPickupSaleReceived(
  payload: KlaviyoSellerNewSaleReceivedPayload,
): Promise<void> {
  if (payload.fulfillmentMethod !== "pickup") return

  const orderAmountNum =
    typeof payload.orderAmount === "number" ? payload.orderAmount : Number(payload.orderAmount)
  const sellerEarningsNum =
    typeof payload.sellerEarnings === "number"
      ? payload.sellerEarnings
      : Number(payload.sellerEarnings)

  const origin = publicSiteOrigin()
  const listingPath = listingDetailHref({
    id: payload.listingId,
    slug: payload.listingSlug ?? undefined,
    section: payload.listingSection,
  })
  const listingUrl = `${origin}${listingPath}`
  const saleUrl = `${origin}/dashboard/sales/${payload.orderId}`
  const pickupInstructions = sellerLocalPickupInstructions()

  await sendKlaviyoServerEvent({
    metricName: "Local Pickup Sale Received",
    profile: {
      external_id: payload.sellerUserId,
      email: payload.sellerEmail,
    },
    uniqueId: `local-pickup-sale-received-${payload.orderId}`,
    value: Number.isFinite(sellerEarningsNum) ? sellerEarningsNum : undefined,
    valueCurrency: "USD",
    properties: {
      order_id: payload.orderId,
      order_num: formatOrderNumForCustomer(payload.orderNum, payload.orderId),
      listing_id: payload.listingId,
      Title: payload.listingTitle,
      fulfillment_method: "pickup",
      payment_method: payload.paymentMethod,
      listing_url: listingUrl,
      sale_url: saleUrl,
      order_amount: Number.isFinite(orderAmountNum) ? orderAmountNum : payload.orderAmount,
      seller_earnings: Number.isFinite(sellerEarningsNum) ? sellerEarningsNum : payload.sellerEarnings,
      buyer_user_id: payload.buyerUserId,
      buyer_display_name: payload.buyerDisplayName,
      pickup_instructions: pickupInstructions,
    },
  })
}
