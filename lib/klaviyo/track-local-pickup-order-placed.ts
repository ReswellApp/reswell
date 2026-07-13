/**
 * Server-only: Klaviyo Events API — fires when a buyer completes checkout with local pickup.
 *
 * **Metric name in Klaviyo:** `Local Pickup Order Placed` — use as the flow trigger (Flows → Metric).
 * Mirrors the shipping order confirmation flow (which uses **Purchase Successful** filtered on
 * `fulfillment_method = shipping`) but is a dedicated metric for pickup-specific buyer email.
 *
 * Template variables: `{{ event.order_num }}`, `{{ event.Title }}`, `{{ event.order_url }}`,
 * `{{ event.listing_url }}`, `{{ event.pickup_code }}`, `{{ event.payment_method }}`,
 * `{{ event.listing_image_url }}`, `{{ event.order_total_display }}`, `{{ event.item_subtotal_display }}`.
 * Email HTML: `lib/klaviyo/buyer-local-pickup-order-email-liquid.ts` (content-only block, no `{% %}` tags).
 *
 * Profile on the event is the **buyer** (`external_id` + email when available).
 */

import { listingDetailHref } from "@/lib/listing-href"
import {
  isKlaviyoPlaceholderListingPhotoUrl,
  klaviyoCommerceEventProperties,
  klaviyoEmailListingPhotoUrl,
  listingToKlaviyoCheckoutEventItem,
  listingToKlaviyoEventCommerceItem,
  type KlaviyoEventCommerceItem,
} from "@/lib/klaviyo/catalog-product"
import { klaviyoBuyerOrderPriceProperties } from "@/lib/klaviyo/order-charges-for-email"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import type { KlaviyoBuyerOrderConfirmedPayload } from "@/lib/klaviyo/track-buyer-order-confirmed"

function resolveEmailListingPhotoUrl(
  explicitUrl: string | null | undefined,
  computedUrl: string,
): string {
  if (explicitUrl?.trim()) {
    const fromExplicit = klaviyoEmailListingPhotoUrl(explicitUrl)
    if (fromExplicit.trim()) return fromExplicit
  }
  const trimmed = computedUrl.trim()
  if (!trimmed || isKlaviyoPlaceholderListingPhotoUrl(trimmed)) return ""
  return trimmed
}

function withEmailListingPhotos(
  commerceItems: KlaviyoEventCommerceItem[],
  payload: KlaviyoBuyerOrderConfirmedPayload,
): KlaviyoEventCommerceItem[] {
  return commerceItems.map((item, idx) => {
    const explicit =
      payload.lineItems?.[idx]?.listingImageUrl ??
      (idx === 0 ? payload.listingImageUrl : null)
    return {
      ...item,
      ImageURL: resolveEmailListingPhotoUrl(explicit, item.ImageURL),
    }
  })
}

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

  const primaryItemPrice =
    payload.lineItems?.[0]?.price ?? priceProperties.item_subtotal_usd

  const commerceItem = listingToKlaviyoEventCommerceItem({
    id: payload.listingId,
    slug: payload.listingSlug,
    title: payload.listingTitle,
    price: primaryItemPrice,
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

  const commerceItemsForEmail = withEmailListingPhotos(commerceItems, payload)
  const listingImageUrl = commerceItemsForEmail[0]?.ImageURL?.trim() ?? ""

  const checkoutItems = payload.lineItems?.length
    ? payload.lineItems.map((line) =>
        listingToKlaviyoCheckoutEventItem({
          id: line.listingId,
          slug: line.listingSlug,
          title: line.listingTitle,
          price: line.price,
          section: line.listingSection,
          listing_images: line.listingImageUrl
            ? [{ url: line.listingImageUrl, is_primary: true }]
            : null,
        }),
      )
    : [
        listingToKlaviyoCheckoutEventItem({
          id: payload.listingId,
          slug: payload.listingSlug,
          title: payload.listingTitle,
          price: primaryItemPrice,
          section: payload.listingSection,
          listing_images: payload.listingImageUrl
            ? [{ url: payload.listingImageUrl, is_primary: true }]
            : null,
        }),
      ]

  const checkoutItemsForEmail = checkoutItems.map((item, idx) => {
    const explicit =
      payload.lineItems?.[idx]?.listingImageUrl ??
      (idx === 0 ? payload.listingImageUrl : null)
    const imageUrl = resolveEmailListingPhotoUrl(explicit, item.image_url)
    return { ...item, image_url: imageUrl }
  })

  await sendKlaviyoServerEvent({
    metricName: "Local Pickup Order Placed",
    profile,
    uniqueId: `local-pickup-order-placed-${payload.orderId}`,
    value: Number.isFinite(amountNum) ? amountNum : undefined,
    valueCurrency: "USD",
    properties: {
      ...klaviyoCommerceEventProperties({
        primaryProductId: payload.listingId,
        items: commerceItemsForEmail,
      }),
      order_id: payload.orderId,
      order_num: formatOrderNumForCustomer(payload.orderNum, payload.orderId),
      listing_id: payload.listingId,
      Title: payload.listingTitle,
      fulfillment_method: "pickup",
      payment_method: payload.paymentMethod,
      pickup_code: payload.pickupCode?.trim() ?? "",
      listing_url: listingUrl,
      listing_image_url: listingImageUrl,
      photo_url: listingImageUrl,
      has_product_image: Boolean(listingImageUrl),
      listing_price_display: priceProperties.item_subtotal_display,
      price_display: priceProperties.order_total_display,
      checkout_items: checkoutItemsForEmail,
      order_url: orderUrl,
      ...priceProperties,
    },
  })
}
