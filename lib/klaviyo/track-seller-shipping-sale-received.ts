/**
 * Server-only: Klaviyo Events API — seller new **shipping** order at checkout.
 *
 * **Metric name in Klaviyo:** `Shipping Sale Received` — profile is the **seller**.
 *
 * Template variables: structured ship-to (`ship_to_name`, `ship_to_line1`, …, `ship_to_formatted`),
 * `label_workflow` (`reswell` | `seller_own`), `label_workflow_instructions`,
 * `sale_url`, `shipping_tools_url`, plus order/listing fields from **New Sale Received**.
 *
 * **Klaviyo email:** paste HTML from `lib/klaviyo/seller-shipping-sale-received-email-liquid.ts`
 * (Reswell-label copy; no `{% %}` tags).
 */

import { listingDetailHref } from "@/lib/listing-href"
import {
  parseOrderShippingAddressForKlaviyo,
  resolveSellerShippingLabelWorkflow,
  sellerShippingLabelWorkflowInstructions,
  sellerShippingToolsUrl,
} from "@/lib/klaviyo/seller-sale-event-helpers"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import type { KlaviyoSellerNewSaleReceivedPayload } from "@/lib/klaviyo/track-seller-new-sale-received"

export async function trackKlaviyoSellerShippingSaleReceived(
  payload: KlaviyoSellerNewSaleReceivedPayload,
): Promise<void> {
  if (payload.fulfillmentMethod !== "shipping") return

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
  const shippingToolsUrl = sellerShippingToolsUrl()

  const shipTo = parseOrderShippingAddressForKlaviyo(payload.shippingAddressJson)
  const listings = payload.listingsForShipping ?? []
  const labelWorkflow = resolveSellerShippingLabelWorkflow(listings)
  const labelWorkflowInstructions = sellerShippingLabelWorkflowInstructions(labelWorkflow)

  await sendKlaviyoServerEvent({
    metricName: "Shipping Sale Received",
    profile: {
      external_id: payload.sellerUserId,
      email: payload.sellerEmail,
    },
    uniqueId: `shipping-sale-received-${payload.orderId}`,
    value: Number.isFinite(sellerEarningsNum) ? sellerEarningsNum : undefined,
    valueCurrency: "USD",
    properties: {
      order_id: payload.orderId,
      order_num: formatOrderNumForCustomer(payload.orderNum, payload.orderId),
      listing_id: payload.listingId,
      Title: payload.listingTitle,
      fulfillment_method: "shipping",
      payment_method: payload.paymentMethod,
      listing_url: listingUrl,
      sale_url: saleUrl,
      shipping_tools_url: shippingToolsUrl,
      order_amount: Number.isFinite(orderAmountNum) ? orderAmountNum : payload.orderAmount,
      seller_earnings: Number.isFinite(sellerEarningsNum) ? sellerEarningsNum : payload.sellerEarnings,
      buyer_user_id: payload.buyerUserId,
      buyer_display_name: payload.buyerDisplayName,
      ship_to_name: shipTo?.name ?? "",
      ship_to_phone: shipTo?.phone ?? "",
      ship_to_email: shipTo?.email ?? "",
      ship_to_line1: shipTo?.line1 ?? "",
      ship_to_line2: shipTo?.line2 ?? "",
      ship_to_city: shipTo?.city ?? "",
      ship_to_state: shipTo?.state ?? "",
      ship_to_postal_code: shipTo?.postal_code ?? "",
      ship_to_country: shipTo?.country ?? "",
      ship_to_formatted: shipTo?.formatted ?? "",
      label_workflow: labelWorkflow,
      label_workflow_instructions: labelWorkflowInstructions,
    },
  })
}
