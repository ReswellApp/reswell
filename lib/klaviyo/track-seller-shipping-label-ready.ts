/**
 * Server-only: Klaviyo Events API — Reswell auto-purchased shipping label is ready for the seller.
 *
 * **Metric name in Klaviyo:** `Shipping Label Ready` — profile is the **seller**.
 *
 * Template variables: `{{ event.order_num }}`, `{{ event.Title }}`, `{{ event.sale_url }}`,
 * `{{ event.tracking_number }}`, `{{ event.tracking_carrier }}`, `{{ event.label_instructions }}`.
 */

import {
  sellerSaleUrl,
  sellerShippingToolsUrl,
} from "@/lib/klaviyo/seller-sale-event-helpers"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"

export type KlaviyoSellerShippingLabelReadyPayload = {
  sellerUserId: string
  sellerEmail: string | null
  orderId: string
  orderNum?: string | null
  listingTitle: string
  trackingNumber: string | null
  trackingCarrier: string | null
}

function buildLabelInstructions(trackingNumber: string | null): string {
  const track = trackingNumber?.trim() || null
  return [
    "Your Reswell shipping label is ready on your sale page.",
    "Download and print the label PDF, securely pack the item, and attach the label.",
    "Drop the package with the carrier, then confirm shipment on your sale page.",
    track
      ? `Tracking ${track} is saved on the order — the buyer can follow progress on their purchase page.`
      : "Tracking will appear on the order once the carrier scans the package.",
  ].join(" ")
}

export async function trackKlaviyoSellerShippingLabelReady(
  payload: KlaviyoSellerShippingLabelReadyPayload,
): Promise<void> {
  const saleUrl = sellerSaleUrl(payload.orderId)
  const shippingToolsUrl = sellerShippingToolsUrl()
  const trackingNumber = payload.trackingNumber?.trim() ?? ""
  const trackingCarrier = payload.trackingCarrier?.trim() ?? ""

  await sendKlaviyoServerEvent({
    metricName: "Shipping Label Ready",
    profile: {
      external_id: payload.sellerUserId,
      email: payload.sellerEmail,
    },
    uniqueId: `shipping-label-ready-${payload.orderId}`,
    properties: {
      order_id: payload.orderId,
      order_num: formatOrderNumForCustomer(payload.orderNum, payload.orderId),
      Title: payload.listingTitle,
      sale_url: saleUrl,
      shipping_tools_url: shippingToolsUrl,
      tracking_number: trackingNumber,
      tracking_carrier: trackingCarrier,
      label_instructions: buildLabelInstructions(payload.trackingNumber),
    },
  })
}
