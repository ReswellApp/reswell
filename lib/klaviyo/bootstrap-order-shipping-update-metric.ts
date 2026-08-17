/**
 * Seeds **Order Shipping Update** events so Klaviyo learns `sms_milestone` (and related
 * props) for flow trigger filters before a real carrier milestone fires.
 *
 * Sends one seed per milestone: `out_for_delivery`, `delivered`, `exception`.
 */

import "@/lib/klaviyo/bootstrap-env"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import type { OrderShippingSmsMilestone } from "@/lib/shipping/order-shipping-sms-milestone"

const METRIC_NAME = "Order Shipping Update"
const SEED_PROFILE_EXTERNAL_ID = "reswell-metric-seed-order-shipping-update"

const MILESTONE_SEEDS: {
  milestone: OrderShippingSmsMilestone
  statusCode: string
  statusLabel: string
  uniqueId: string
}[] = [
  {
    milestone: "out_for_delivery",
    statusCode: "OF",
    statusLabel: "Out for Delivery",
    uniqueId: "reswell-seed-order-shipping-update-ofd",
  },
  {
    milestone: "delivered",
    statusCode: "DE",
    statusLabel: "Delivered",
    uniqueId: "reswell-seed-order-shipping-update-delivered",
  },
  {
    milestone: "exception",
    statusCode: "EX",
    statusLabel: "Exception",
    uniqueId: "reswell-seed-order-shipping-update-exception",
  },
]

export type BootstrapOrderShippingUpdateMetricResult = {
  metric_name: string
  milestone: OrderShippingSmsMilestone
  ok: boolean
  skipped: boolean
  status: number
  skipReason?: string
  detail: string
}

export async function bootstrapOrderShippingUpdateMetric(): Promise<{
  results: BootstrapOrderShippingUpdateMetricResult[]
}> {
  const time = new Date().toISOString()
  const results: BootstrapOrderShippingUpdateMetricResult[] = []

  for (const seed of MILESTONE_SEEDS) {
    const r = await sendKlaviyoServerEvent({
      metricName: METRIC_NAME,
      profile: {
        external_id: SEED_PROFILE_EXTERNAL_ID,
      },
      uniqueId: seed.uniqueId,
      properties: {
        time,
        reswell_metric_seed: true,
        order_id: "00000000-0000-0000-0000-000000000001",
        order_num: "SEED",
        Title: "Metric seed — Order Shipping Update",
        tracking_number: "SEED",
        tracking_carrier: "usps",
        status_code: seed.statusCode,
        status_label: seed.statusLabel,
        latest_event_description: seed.statusLabel,
        latest_event_location: "",
        estimated_delivery_date: "",
        is_delivered: seed.milestone === "delivered",
        order_url: "https://reswell.app/dashboard/purchases",
        sms_milestone: seed.milestone,
        has_sms_phone: false,
      },
    })

    results.push({
      metric_name: METRIC_NAME,
      milestone: seed.milestone,
      ok: r.ok,
      skipped: r.skipped,
      status: r.status,
      skipReason: r.skipReason,
      detail: r.detail,
    })
  }

  return { results }
}
