/**
 * Server-only: Klaviyo Events API — fires when a seller’s listing is purchased (payment captured).
 *
 * **Metric name in Klaviyo:** `Sale Successful` — use as the flow trigger (Flows → Metric).
 *
 * **Building the flow in Klaviyo:** Flows → Create flow → Metric → select **Sale Successful** →
 * add email; in the template use event variables, e.g. `{{ event.order_num }}`, `{{ event.Title }}`,
 * `{{ event.order_url }}`, `{{ event.listing_url }}`, `{{ event.seller_earnings }}`, `{{ event.fulfillment_method }}`,
 * `{{ event.payment_method }}`.
 *
 * Profile on the event is the **seller** (`external_id` + email when available).
 */

import { listingDetailHref } from "@/lib/listing-href"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"

export type KlaviyoSellerOrderConfirmedPayload = {
  sellerUserId: string
  sellerEmail: string | null
  orderId: string
  /** From `orders.order_num` (optional for legacy callers). */
  orderNum?: string | null
  listingId: string
  listingTitle: string
  listingSection: string
  listingSlug?: string | null
  /** Total order amount (buyer paid). */
  orderAmount: number
  sellerEarnings: number
  platformFee: number
  fulfillmentMethod: "shipping" | "pickup"
  paymentMethod: "stripe" | "reswell_bucks"
}

export async function trackKlaviyoSellerOrderConfirmed(
  payload: KlaviyoSellerOrderConfirmedPayload,
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
  const orderUrl = `${origin}/dashboard/orders/${payload.orderId}`

  await sendKlaviyoServerEvent({
    metricName: "Sale Successful",
    profile: {
      external_id: payload.sellerUserId,
      email: payload.sellerEmail,
    },
    uniqueId: `sale-successful-${payload.orderId}`,
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
      order_url: orderUrl,
      order_amount: Number.isFinite(orderAmountNum) ? orderAmountNum : payload.orderAmount,
      seller_earnings: Number.isFinite(sellerEarningsNum) ? sellerEarningsNum : payload.sellerEarnings,
      platform_fee: Number.isFinite(platformFeeNum) ? platformFeeNum : payload.platformFee,
    },
  })
}
