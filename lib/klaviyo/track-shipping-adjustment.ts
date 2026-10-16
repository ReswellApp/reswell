/**
 * Server-only: Klaviyo Events API — fires when a seller's shipment is adjusted
 * by the carrier.
 *
 * **Metric name in Klaviyo:** `Shipping Adjustment` — use as the flow trigger
 * (Flows → Metric). Profile is the **seller**.
 *
 * Filter `reswell_metric_seed` is not true. `coverage` is `covered_strike` or
 * `charged_to_earnings`.
 *
 * Suggested subject: `Carrier adjustment on {{ event.Title }}`
 * Template: `lib/klaviyo/shipping-adjustment-email-liquid.ts`.
 */

import { sellerSaleUrl } from "@/lib/klaviyo/seller-sale-event-helpers"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { SHIPPING_ADJUSTMENT_LEARN_MORE_HREF, shippingAdjustmentSellerCopy, type ShippingAdjustmentCoverage } from "@/lib/shipping/adjustment-strike"
import { formatAdjustmentUsd } from "@/lib/shipping/adjustment-fee"

export const SHIPPING_ADJUSTMENT_METRIC = "Shipping Adjustment"

export type KlaviyoShippingAdjustmentPayload = {
  sellerUserId: string
  sellerEmail: string | null
  orderId: string
  orderNum?: string | null
  listingTitle: string
  adjustmentId: string
  coverage: ShippingAdjustmentCoverage
  amountUsd: number
  earningsDeductedUsd: number
  trackingNumber?: string | null
  lengthIn?: number | null
  widthIn?: number | null
  heightIn?: number | null
}

function measuredSize(payload: KlaviyoShippingAdjustmentPayload): string {
  if (payload.lengthIn == null && payload.widthIn == null && payload.heightIn == null) return ""
  return [payload.lengthIn, payload.widthIn, payload.heightIn]
    .map((value) => (value == null ? "—" : String(value)))
    .join(" × ")
}

export async function trackKlaviyoShippingAdjustment(
  payload: KlaviyoShippingAdjustmentPayload,
): Promise<boolean> {
  const copy = shippingAdjustmentSellerCopy({
    coverage: payload.coverage,
    amountUsd: payload.amountUsd,
    earningsDeductedUsd: payload.earningsDeductedUsd,
    listingTitle: payload.listingTitle,
  })
  const origin = publicSiteOrigin()
  const howToShipUrl = `${origin}${SHIPPING_ADJUSTMENT_LEARN_MORE_HREF}`
  const event = await sendKlaviyoServerEvent({
    metricName: SHIPPING_ADJUSTMENT_METRIC,
    profile: {
      external_id: payload.sellerUserId,
      email: payload.sellerEmail,
    },
    uniqueId: `shipping-adjustment-${payload.adjustmentId}`,
    value: payload.amountUsd,
    valueCurrency: "USD",
    properties: {
      order_id: payload.orderId,
      order_num: formatOrderNumForCustomer(payload.orderNum, payload.orderId),
      Title: payload.listingTitle,
      sale_url: sellerSaleUrl(payload.orderId),
      how_to_ship_url: howToShipUrl,
      adjustment_id: payload.adjustmentId,
      coverage: payload.coverage,
      covered: payload.coverage === "covered_strike",
      amount_usd: payload.amountUsd,
      amount_display: formatAdjustmentUsd(payload.amountUsd),
      earnings_deducted_usd: payload.earningsDeductedUsd,
      earnings_deducted_display: formatAdjustmentUsd(payload.earningsDeductedUsd),
      tracking_number: payload.trackingNumber?.trim() ?? "",
      measured_size: measuredSize(payload),
      headline: copy.headline,
      message: copy.message,
      reswell_metric_seed: false,
    },
  })
  return event.ok
}
