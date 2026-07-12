/**
 * Server-only: Klaviyo Events API — fires when a buyer completes checkout (order placed).
 *
 * **Metric name in Klaviyo:** `Placed Order` — use as the flow trigger (Flows → Metric).
 * Standard commerce metric for order confirmation and abandoned-checkout suppression
 * (e.g. has not done **Placed Order** since **Checkout Started**).
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
import { klaviyoBuyerOrderPriceProperties } from "@/lib/klaviyo/order-charges-for-email"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import type { KlaviyoBuyerOrderConfirmedPayload } from "@/lib/klaviyo/track-buyer-order-confirmed"

export async function trackKlaviyoPlacedOrder(
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

  const priceProperties = klaviyoBuyerOrderPriceProperties({
    amount: amountNum,
    itemSubtotalUsd: payload.itemSubtotalUsd,
    shippingAmountUsd: payload.shippingAmountUsd,
    promoDiscountUsd: payload.promoDiscountUsd,
    promoCode: payload.promoCode,
    promoKind: payload.promoKind,
    promoLabel: payload.promoLabel,
    lineItems: payload.lineItems,
  })

  await sendKlaviyoServerEvent({
    metricName: "Placed Order",
    profile,
    uniqueId: `placed-order-${payload.orderId}`,
    value: Number.isFinite(amountNum) ? amountNum : undefined,
    valueCurrency: "USD",
    properties: {
      ...klaviyoCommerceEventProperties({
        primaryProductId: payload.listingId,
        items: payload.lineItems?.length
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
          : [commerceItem],
      }),
      order_id: payload.orderId,
      order_num: formatOrderNumForCustomer(payload.orderNum, payload.orderId),
      listing_id: payload.listingId,
      Title: payload.listingTitle,
      fulfillment_method: payload.fulfillmentMethod,
      payment_method: payload.paymentMethod,
      listing_url: listingUrl,
      order_url: orderUrl,
      ...priceProperties,
    },
  })
}
