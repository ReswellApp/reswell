import { createHash } from "node:crypto"
import {
  dbListUnalertedIncreasedAdjustments,
  dbMarkShipEngineAdjustmentsAdminAlerted,
} from "@/lib/db/shipengineLabelAdjustments"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { publicSiteOrigin } from "@/lib/public-site-origin"
import { createServiceRoleClient } from "@/lib/supabase/server"

const ALERT_METRIC = "ShipEngine Label Adjustment Alert"
const ALERT_BATCH_SIZE = 500
export const SHIPENGINE_ADJUSTMENT_ALERT_PROFILE_ID =
  "reswell-admin-shipengine-adjustment-alerts"

export type ShipEngineAdjustmentAdminAlertSummary = {
  sent: boolean
  skipped: boolean
  adjustmentCount: number
  totalIncreaseUsd: number
  hasMore: boolean
}

export async function bootstrapShipEngineAdjustmentAdminAlertMetric(): Promise<
  | { ok: true; status: number; skipped: boolean; profileId: string }
  | { ok: false; error: string }
> {
  const event = await sendKlaviyoServerEvent({
    metricName: ALERT_METRIC,
    profile: { external_id: SHIPENGINE_ADJUSTMENT_ALERT_PROFILE_ID },
    uniqueId: "shipengine-adjustment-alert-metric-seed-v1",
    value: 1,
    valueCurrency: "USD",
    properties: {
      adjustment_count: 1,
      adjustment_count_display: "1",
      total_increase_usd: 1,
      total_increase_display: "$1.00",
      has_more: false,
      tracking_numbers: ["SEED"],
      dashboard_url: `${publicSiteOrigin()}/admin/shipping?tab=adjusted-labels`,
      sms_message: "Metric seed — do not send",
      reswell_metric_seed: true,
    },
  })

  if (!event.ok) {
    return {
      ok: false,
      error:
        event.skipReason ??
        `Klaviyo adjustment alert seed failed (${event.status || "network error"})`,
    }
  }

  return {
    ok: true,
    status: event.status,
    skipped: event.skipped,
    profileId: SHIPENGINE_ADJUSTMENT_ALERT_PROFILE_ID,
  }
}

export async function sendShipEngineAdjustmentAdminAlert(): Promise<
  | { ok: true; summary: ShipEngineAdjustmentAdminAlertSummary }
  | { ok: false; error: string }
> {
  let supabase: ReturnType<typeof createServiceRoleClient>
  try {
    supabase = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Server misconfigured" }
  }

  const pending = await dbListUnalertedIncreasedAdjustments(
    supabase,
    ALERT_BATCH_SIZE,
  )
  if (pending.error) return { ok: false, error: pending.error.message }

  if (pending.data.length === 0) {
    return {
      ok: true,
      summary: {
        sent: false,
        skipped: false,
        adjustmentCount: 0,
        totalIncreaseUsd: 0,
        hasMore: false,
      },
    }
  }

  const totalCents = pending.data.reduce(
    (sum, row) => sum + Math.round(row.adjustment_amount_usd * 100),
    0,
  )
  const totalIncreaseUsd = totalCents / 100
  const countLabel = `${pending.data.length}${pending.hasMore ? "+" : ""}`
  const totalDisplay = new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(totalIncreaseUsd)
  const dashboardUrl = `${publicSiteOrigin()}/admin/shipping?tab=adjusted-labels`
  const uniqueIdHash = createHash("sha256")
    .update(pending.data.map((row) => row.id).sort().join(","))
    .digest("hex")
    .slice(0, 32)

  const event = await sendKlaviyoServerEvent({
    metricName: ALERT_METRIC,
    profile: { external_id: SHIPENGINE_ADJUSTMENT_ALERT_PROFILE_ID },
    uniqueId: `shipengine-adjustment-alert-${uniqueIdHash}`,
    value: totalIncreaseUsd,
    valueCurrency: "USD",
    properties: {
      adjustment_count: pending.data.length,
      adjustment_count_display: countLabel,
      total_increase_usd: totalIncreaseUsd,
      total_increase_display: totalDisplay,
      has_more: pending.hasMore,
      tracking_numbers: pending.data
        .map((row) => row.tracking_number)
        .filter((tracking): tracking is string => Boolean(tracking))
        .slice(0, 10),
      dashboard_url: dashboardUrl,
      sms_message: `Reswell admin: ${countLabel} new ShipEngine label adjustment${pending.data.length === 1 ? "" : "s"} totaling ${totalDisplay}. ${dashboardUrl}`,
      reswell_metric_seed: false,
    },
  })

  if (!event.ok) {
    return {
      ok: false,
      error:
        event.skipReason ??
        `Klaviyo adjustment alert event failed (${event.status || "network error"})`,
    }
  }

  const marked = await dbMarkShipEngineAdjustmentsAdminAlerted(
    supabase,
    pending.data.map((row) => row.id),
    new Date().toISOString(),
  )
  if (marked.error) return { ok: false, error: marked.error.message }

  return {
    ok: true,
    summary: {
      sent: true,
      skipped: false,
      adjustmentCount: pending.data.length,
      totalIncreaseUsd,
      hasMore: pending.hasMore,
    },
  }
}
