/**
 * Server-only: Klaviyo Events API — fires when a buyer completes checkout with local pickup.
 *
 * **Metric name in Klaviyo:** `Local Pickup Order Placed` — use as the flow trigger (Flows → Metric).
 * Mirrors the shipping order confirmation flow (which uses **Purchase Successful** filtered on
 * `fulfillment_method = shipping`) but is a dedicated metric for pickup-specific buyer email.
 *
 * Template variables: `{{ event.order_num }}`, `{{ event.Title }}`, `{{ event.order_url }}`,
 * `{{ event.listing_url }}`, `{{ event.pickup_code }}`, `{{ event.payment_method }}`.
 *
 * Profile on the event is the **buyer** (`external_id` + email when available).
 */

import { listingDetailHref } from "@/lib/listing-href"
import {
  klaviyoCommerceEventProperties,
  listingToKlaviyoEventCommerceItem,
} from "@/lib/klaviyo/catalog-product"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import type { KlaviyoBuyerOrderConfirmedPayload } from "@/lib/klaviyo/track-buyer-order-confirmed"

export async function trackKlaviyoLocalPickupOrderPlaced(
  payload: KlaviyoBuyerOrderConfirmedPayload,
): Promise<void> {
  if (payload.fulfillmentMethod !== "pickup") return

  const amountNum =
    typeof payload.amount === "number" ? payload.amount : Number(payload.amount)
  const origin = publicSiteOrigin()
  const listingPath = listingDetailHref({
    id: payload.listingId,
    slug: payload.listingSlug ?? undefined,
    section: payload.listingSection,
  })
  const listingUrl = `${origin}${listingPath}`
  const orderUrl = `${origin}/dashboard/purchases/${payload.orderId}`

  const profile =
    payload.buyerUserId?.trim()
      ? { external_id: payload.buyerUserId.trim(), email: payload.buyerEmail }
      : {
          email: payload.buyerEmail,
          anonymous_id: `guest-order-${payload.orderId}`,
        }

  const commerceItem = listingToKlaviyoEventCommerceItem({
    id: payload.listingId,
    slug: payload.listingSlug,
    title: payload.listingTitle,
    price: payload.amount,
    section: payload.listingSection,
    listing_images: payload.listingImageUrl
      ? [{ url: payload.listingImageUrl, is_primary: true }]
      : null,
  })
  const commerceItems = payload.lineItems?.length
    ? payload.lineItems.map((line) =>
        listingToKlaviyoEventCommerceItem(
          {
            id: line.listingId,
            slug: line.listingSlug,
            title: line.listingTitle,
            price: line.price,
            section: line.listingSection,
            listing_images: line.listingImageUrl
              ? [{ url: line.listingImageUrl, is_primary: true }]
              : null,
          },
          line.quantity ?? 1,
        ),
      )
    : [commerceItem]

  await sendKlaviyoServerEvent({
    metricName: "Local Pickup Order Placed",
    profile,
    uniqueId: `local-pickup-order-placed-${payload.orderId}`,
    value: Number.isFinite(amountNum) ? amountNum : undefined,
    valueCurrency: "USD",
    properties: {
      ...klaviyoCommerceEventProperties({
        primaryProductId: payload.listingId,
        items: commerceItems,
      }),
      order_id: payload.orderId,
      order_num: formatOrderNumForCustomer(payload.orderNum, payload.orderId),
      listing_id: payload.listingId,
      Title: payload.listingTitle,
      fulfillment_method: "pickup",
      payment_method: payload.paymentMethod,
      pickup_code: payload.pickupCode?.trim() ?? "",
      listing_url: listingUrl,
      order_url: orderUrl,
    },
  })
}
