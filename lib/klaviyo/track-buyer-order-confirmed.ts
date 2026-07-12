/**
 * Server-only: Klaviyo Events API — fires when a buyer’s purchase succeeds (payment captured).
 *
 * **Metric name in Klaviyo:** `Purchase Successful` — use as the flow trigger (Flows → Metric).
 * Also emits **Placed Order** (standard commerce metric; same payload).
 * Pickup checkouts also emit **Local Pickup Order Placed** (dedicated pickup buyer email trigger).
 *
 * **Building the flow in Klaviyo:** Flows → Create flow → Metric → select **Purchase Successful** →
 * add email; in the template use event variables, e.g. `{{ event.order_num }}`, `{{ event.Title }}`,
 * `{{ event.order_url }}`, `{{ event.listing_url }}`, `{{ event.listing_image_url }}`,
 * `{{ event.fulfillment_method }}`, `{{ event.payment_method }}`.
 * For shipping-only confirmation, filter `fulfillment_method` equals `shipping`. For pickup, use metric **Local Pickup Order Placed** instead.
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
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { trackKlaviyoLocalPickupOrderPlaced } from "@/lib/klaviyo/track-local-pickup-order-placed"
import { trackKlaviyoPlacedOrder } from "@/lib/klaviyo/track-placed-order"
import { klaviyoBuyerOrderPriceProperties } from "@/lib/klaviyo/order-charges-for-email"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import type { CheckoutPromoKind } from "@/lib/services/checkoutPromo"

export type KlaviyoBuyerOrderLineItem = {
  listingId: string
  listingTitle: string
  listingSection: string
  listingSlug?: string | null
  listingImageUrl?: string | null
  price: number
  quantity?: number
}

export type KlaviyoBuyerOrderConfirmedPayload = {
  /** Omitted for sessionless guest checkout (email-only Klaviyo profile). */
  buyerUserId?: string | null
  buyerEmail: string | null
  orderId: string
  /** From `orders.order_num` (optional for legacy callers). */
  orderNum?: string | null
  listingId: string
  listingTitle: string
  listingSection: string
  listingSlug?: string | null
  listingImageUrl?: string | null
  /** Optional multi-item checkout lines (defaults to primary listing). */
  lineItems?: KlaviyoBuyerOrderLineItem[]
  amount: number
  fulfillmentMethod: "shipping" | "pickup"
  /** Six-digit code the buyer shows the seller at pickup (pickup orders only). */
  pickupCode?: string | null
  paymentMethod: "stripe" | "reswell_bucks" | "cash"
  /** Sum of item prices before shipping / promos (optional — derived when omitted). */
  itemSubtotalUsd?: number | null
  /** Buyer-paid shipping stored on `orders.shipping_amount`. */
  shippingAmountUsd?: number | null
  /** Buyer promo credit stored on `orders.promo_discount_usd`. */
  promoDiscountUsd?: number | null
  /** Redeemed promo code string, e.g. `WELCOME-ABC123`. */
  promoCode?: string | null
  promoKind?: CheckoutPromoKind | null
  /** Optional override for promo row label in email. */
  promoLabel?: string | null
}

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

  const listingImageUrl =
    commerceItemsForEmail[0]?.ImageURL?.trim() ||
    checkoutItemsForEmail[0]?.image_url?.trim() ||
    ""

  await sendKlaviyoServerEvent({
    metricName: "Purchase Successful",
    profile,
    uniqueId: `purchase-successful-${payload.orderId}`,
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
      fulfillment_method: payload.fulfillmentMethod,
      payment_method: payload.paymentMethod,
      listing_url: listingUrl,
      listing_image_url: listingImageUrl,
      photo_url: listingImageUrl,
      has_product_image: Boolean(listingImageUrl),
      order_url: orderUrl,
      checkout_items: checkoutItemsForEmail,
      ...priceProperties,
    },
  })

  await trackKlaviyoPlacedOrder(payload)

  if (payload.fulfillmentMethod === "pickup") {
    await trackKlaviyoLocalPickupOrderPlaced(payload)
  }
}
