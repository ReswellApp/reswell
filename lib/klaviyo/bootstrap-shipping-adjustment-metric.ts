/**
 * Sends one minimal Events API event so **Shipping Adjustment** appears under
 * Flows → Your metrics → API before a real carrier adjustment is ingested.
 */

import "@/lib/klaviyo/bootstrap-env"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { SHIPPING_ADJUSTMENT_METRIC } from "@/lib/klaviyo/track-shipping-adjustment"

const SEED_PROFILE_EXTERNAL_ID = "reswell-metric-seed-shipping-adjustment"

export type BootstrapShippingAdjustmentMetricResult = {
  metric_name: string
  ok: boolean
  skipped: boolean
  status: number
  skipReason?: string
  detail: string
}

export async function bootstrapShippingAdjustmentMetric(): Promise<{
  result: BootstrapShippingAdjustmentMetricResult
}> {
  const r = await sendKlaviyoServerEvent({
    metricName: SHIPPING_ADJUSTMENT_METRIC,
    profile: { external_id: SEED_PROFILE_EXTERNAL_ID },
    uniqueId: "reswell-seed-shipping-adjustment",
    value: 1,
    valueCurrency: "USD",
    properties: {
      reswell_metric_seed: true,
      order_id: "00000000-0000-0000-0000-000000000000",
      order_num: "SEED",
      Title: "Shipping adjustment (metric seed)",
      sale_url: "https://reswell.app/dashboard/sales",
      how_to_ship_url: "https://reswell.app/seller-resources/how-to-ship#adjustments",
      adjustment_id: "seed",
      coverage: "covered_strike",
      covered: true,
      amount_usd: 1,
      amount_display: "$1.00",
      earnings_deducted_usd: 0,
      earnings_deducted_display: "$0.00",
      tracking_number: "SEED",
      measured_size: "76 × 22 × 5",
      headline: "Reswell covered this carrier adjustment",
      message:
        "Metric seed — do not send. The carrier adjusted a shipment. Reswell covers the first one. The next adjustment on a shipped item is deducted from earnings on that sale.",
    },
  })

  return {
    result: {
      metric_name: SHIPPING_ADJUSTMENT_METRIC,
      ok: r.ok,
      skipped: r.skipped,
      status: r.status,
      skipReason: r.skipReason,
      detail: r.detail,
    },
  }
}
