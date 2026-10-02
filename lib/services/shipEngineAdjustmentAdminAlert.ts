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

export type ShipEngineAdjustmentAdminAlertSummary = {
  sent: boolean
  skipped: boolean
  adjustmentCount: number
  totalIncreaseUsd: number
  hasMore: boolean
  reason?: string
}

export function normalizeAdminAlertPhone(value: string | undefined): string | null {
  const trimmed = value?.trim()
  if (!trimmed) return null

  const normalized = trimmed.startsWith("+")
    ? `+${trimmed.slice(1).replace(/\D/g, "")}`
    : trimmed.replace(/\D/g, "").length === 10
      ? `+1${trimmed.replace(/\D/g, "")}`
      : `+${trimmed.replace(/\D/g, "")}`

  return /^\+[1-9]\d{7,14}$/.test(normalized) ? normalized : null
}

export async function sendShipEngineAdjustmentAdminAlert(): Promise<
  | { ok: true; summary: ShipEngineAdjustmentAdminAlertSummary }
  | { ok: false; error: string }
> {
  const configuredPhone = process.env.SHIPENGINE_ADJUSTMENT_ALERT_PHONE
  const phoneNumber = normalizeAdminAlertPhone(configuredPhone)

  if (!configuredPhone?.trim()) {
    return {
      ok: true,
      summary: {
        sent: false,
        skipped: true,
        adjustmentCount: 0,
        totalIncreaseUsd: 0,
        hasMore: false,
        reason: "SHIPENGINE_ADJUSTMENT_ALERT_PHONE not set",
      },
    }
  }

  if (!phoneNumber) {
    return {
      ok: false,
      error: "SHIPENGINE_ADJUSTMENT_ALERT_PHONE must be a valid E.164 phone number",
    }
  }

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
    profile: { phone_number: phoneNumber },
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
