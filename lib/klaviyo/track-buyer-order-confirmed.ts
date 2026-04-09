/**
 * Server-only: Klaviyo Events API — fires when a buyer’s purchase succeeds (payment captured).
 *
 * **Metric name in Klaviyo:** `Purchase Successful` — use as the flow trigger (Flows → Metric).
 *
 * **Building the flow in Klaviyo:** Flows → Create flow → Metric → select **Purchase Successful** →
 * add email; in the template use event variables, e.g. `{{ event.order_num }}`, `{{ event.Title }}`,
 * `{{ event.order_url }}`, `{{ event.listing_url }}`, `{{ event.fulfillment_method }}`, `{{ event.payment_method }}`.
 *
 * Profile on the event is the **buyer** (`external_id` + email when available).
 */

import { listingDetailHref } from "@/lib/listing-href"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"

export type KlaviyoBuyerOrderConfirmedPayload = {
  buyerUserId: string
  buyerEmail: string | null
  orderId: string
  /** From `orders.order_num` (optional for legacy callers). */
  orderNum?: string | null
  listingId: string
  listingTitle: string
  listingSection: string
  listingSlug?: string | null
  amount: number
  fulfillmentMethod: "shipping" | "pickup"
  paymentMethod: "stripe" | "reswell_bucks"
}

export async function trackKlaviyoBuyerOrderConfirmed(
  payload: KlaviyoBuyerOrderConfirmedPayload,
): Promise<void> {
  const amountNum =
    typeof payload.amount === "number" ? payload.amount : Number(payload.amount)
  const origin = publicSiteOrigin()
  const listingPath = listingDetailHref({
    id: payload.listingId,
    slug: payload.listingSlug ?? undefined,
    section: payload.listingSection,
  })
  const listingUrl = `${origin}${listingPath}`
  const orderUrl = `${origin}/dashboard/orders/${payload.orderId}`

  await sendKlaviyoServerEvent({
    metricName: "Purchase Successful",
    profile: {
      external_id: payload.buyerUserId,
      email: payload.buyerEmail,
    },
    uniqueId: `purchase-successful-${payload.orderId}`,
    value: Number.isFinite(amountNum) ? amountNum : undefined,
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
    },
  })
}
