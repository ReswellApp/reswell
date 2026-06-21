/**
 * Server-only: Klaviyo Events API — fires when a seller receives a new paid order at checkout.
 *
 * **Metric name in Klaviyo:** `New Sale Received` — profile is the **seller**.
 * Also emits **Shipping Sale Received** or **Local Pickup Sale Received** by fulfillment type.
 *
 * Template variables: `{{ event.order_num }}`, `{{ event.Title }}`, `{{ event.sale_url }}`,
 * `{{ event.order_amount }}`, `{{ event.seller_earnings }}`, `{{ event.fulfillment_method }}`,
 * `{{ event.payment_method }}`, `{{ event.buyer_display_name }}`.
 */

import { listingDetailHref } from "@/lib/listing-href"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { trackKlaviyoSellerLocalPickupSaleReceived } from "@/lib/klaviyo/track-seller-local-pickup-sale-received"
import { trackKlaviyoSellerShippingSaleReceived } from "@/lib/klaviyo/track-seller-shipping-sale-received"
import type { PeerListingForShippingQuote } from "@/lib/services/peerListingShippingQuote"

export type KlaviyoSellerNewSaleReceivedPayload = {
  sellerUserId: string
  sellerEmail: string | null
  buyerUserId: string
  buyerDisplayName: string
  orderId: string
  orderNum?: string | null
  listingId: string
  listingTitle: string
  listingSection: string
  listingSlug?: string | null
  orderAmount: number
  sellerEarnings: number
  platformFee: number
  fulfillmentMethod: "shipping" | "pickup"
  paymentMethod: "stripe" | "reswell_bucks"
  shippingAddressJson?: Record<string, unknown> | null
  /** Surfboard/fins listings in the order — used to resolve Reswell vs seller label workflow. */
  listingsForShipping?: PeerListingForShippingQuote[]
}

export async function trackKlaviyoSellerNewSaleReceived(
  payload: KlaviyoSellerNewSaleReceivedPayload,
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

  await sendKlaviyoServerEvent({
    metricName: "New Sale Received",
    profile: {
      external_id: payload.sellerUserId,
      email: payload.sellerEmail,
    },
    uniqueId: `new-sale-received-${payload.orderId}`,
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
      sale_url: saleUrl,
      order_amount: Number.isFinite(orderAmountNum) ? orderAmountNum : payload.orderAmount,
      seller_earnings: Number.isFinite(sellerEarningsNum) ? sellerEarningsNum : payload.sellerEarnings,
      platform_fee: Number.isFinite(platformFeeNum) ? platformFeeNum : payload.platformFee,
      buyer_user_id: payload.buyerUserId,
      buyer_display_name: payload.buyerDisplayName,
    },
  })

  if (payload.fulfillmentMethod === "shipping") {
    await trackKlaviyoSellerShippingSaleReceived(payload)
  } else {
    await trackKlaviyoSellerLocalPickupSaleReceived(payload)
  }
}
