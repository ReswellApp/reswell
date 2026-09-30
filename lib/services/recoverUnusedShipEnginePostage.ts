import type { SupabaseClient } from "@supabase/supabase-js"
import { dbMatchTrackingToOrders } from "@/lib/db/shipengineLabelSpend"
import { fetchLabelById } from "@/lib/shipengine/label-lookup"
import { listPurchasedShipEngineLabels } from "@/lib/shipengine/list-purchased-labels"
import { getReswellUpsCarrierId } from "@/lib/shipengine/config"
import { voidShipEngineLabel } from "@/lib/shipengine/label-void"
import { fetchShipEngineTrackingByLabelId } from "@/lib/shipengine/tracking"
import { shipEngineTrackingIndicatesPhysicalScan } from "@/lib/shipping/label-carrier-scan"
import {
  executePostageRecovery,
  type PostageAuditRow,
  type PostageRecoveryLabel,
  type PostageRecoveryRun,
} from "@/lib/shipping/recover-unused-postage"
import { POSTAGE_AUDIT_LOOKBACK_DAYS } from "@/lib/shipping/unused-label-void-policy"
import { buildOrderTrackingDetailFromShipEngineData } from "@/lib/shipping/order-tracking-detail"
import { normalizeTrackingNumberForCarrier } from "@/lib/shipping/normalize-tracking-number"

export type PostageRecoverySnapshot = {
  finishedAt: string
  /** True when the scheduled job is allowed to void. The admin button voids either way. */
  autoVoidEnabled: boolean
  dryRun: boolean
  truncated: boolean
  listedCount: number
  lookbackDays: number
  buyerRefundsIssued: 0
  summary: PostageRecoveryRun["summary"]
  cracks: PostageRecoveryRun["cracks"]
  recoveredThisRun: PostageRecoveryRun["recoveredThisRun"]
  readyToVoid: PostageRecoveryRun["readyToVoid"]
}

const MS_PER_DAY = 86_400_000

/** Unset or any value other than false/0/off keeps the daily void job on. */
export function isUnusedLabelAutoVoidEnabled(): boolean {
  const raw = process.env.SHIPENGINE_UNUSED_LABEL_AUTO_VOID?.trim().toLowerCase()
  if (!raw) return true
  return raw !== "false" && raw !== "0" && raw !== "off"
}

function trackingKey(tracking: string | null | undefined): string {
  if (!tracking) return ""
  return normalizeTrackingNumberForCarrier(tracking) || tracking.trim()
}

/**
 * Audit ShipEngine labels in the void window and void unused ones.
 * ShipEngine is the billing record. This does not copy labels into another table.
 * Credits the ShipEngine balance (or closes Reswell UPS billing). Never refunds a buyer.
 */
export async function recoverUnusedShipEnginePostage(params: {
  supabase: SupabaseClient
  now?: Date
  /** Admin click. Ignores the cron kill switch. */
  force?: boolean
  /** Read ShipEngine and report. Do not void. */
  dryRun?: boolean
}): Promise<
  | { ok: true; data: PostageRecoverySnapshot; warnings: string[] }
  | { ok: false; error: string; status: number }
> {
  const now = params.now ?? new Date()
  const dryRun = params.dryRun === true
  const cronEnabled = isUnusedLabelAutoVoidEnabled()
  const autoVoidEnabled = dryRun || params.force ? true : cronEnabled
  const start = new Date(now.getTime() - POSTAGE_AUDIT_LOOKBACK_DAYS * MS_PER_DAY)
  const end = new Date(now.getTime() + 60_000)

  const listed = await listPurchasedShipEngineLabels({
    createdAtStartIso: start.toISOString(),
    createdAtEndIso: end.toISOString(),
  })
  if (!listed.ok) {
    return { ok: false, error: listed.error, status: listed.status }
  }

  const warnings: string[] = []
  if (listed.truncated) {
    warnings.push(
      "ShipEngine returned a partial label list. Recovery ran on the labels we could see; the audit is incomplete.",
    )
    console.error("[postage recovery] label list truncated", {
      listed: listed.labels.length,
      total: listed.total,
    })
  }

  const trackingNumbers = listed.labels
    .map((label) => label.trackingNumber)
    .filter((tn): tn is string => Boolean(tn))

  const matches = await dbMatchTrackingToOrders(params.supabase, trackingNumbers)
  if (matches.error) warnings.push(`Could not match labels to orders: ${matches.error.message}`)

  const labels: PostageRecoveryLabel[] = listed.labels.map((label) => {
    const match = trackingKey(label.trackingNumber)
    return {
      labelId: label.labelId,
      createdAt: label.createdAt,
      trackingNumber: label.trackingNumber,
      carrierCode: label.carrierCode,
      carrierId: label.carrierId,
      serviceCode: label.serviceCode,
      voided: label.voided,
      isReturnLabel: label.isReturnLabel,
      postageUsd: label.postageUsd,
      insuranceUsd: label.insuranceUsd,
      orderId: match ? (matches.data.get(match)?.orderId ?? null) : null,
      adminVoidRequested: false,
      attemptCount: 0,
    }
  })

  const run = await executePostageRecovery({
    labels,
    now,
    autoVoidEnabled,
    dryRun,
    reswellUpsCarrierId: getReswellUpsCarrierId(),
    truncated: listed.truncated,
    deps: {
      trackLabel: trackForRecovery,
      readLabel: readForRecovery,
      voidLabel: voidForRecovery,
    },
  })

  const snapshot: PostageRecoverySnapshot = {
    finishedAt: new Date().toISOString(),
    autoVoidEnabled: cronEnabled,
    dryRun,
    truncated: run.truncated,
    listedCount: listed.labels.length,
    lookbackDays: run.lookbackDays,
    buyerRefundsIssued: 0,
    summary: run.summary,
    cracks: run.cracks,
    recoveredThisRun: run.recoveredThisRun,
    readyToVoid: run.readyToVoid,
  }

  if (!dryRun) {
    await clearTrackingForRecoveredLabels(params.supabase, run.rows)
  }

  if (run.summary.expiredLostUsd > 0) {
    console.error("[postage recovery] postage past the carrier void deadline", {
      usd: run.summary.expiredLostUsd,
      count: run.summary.expiredLostCount,
    })
  }
  console.info("[postage recovery]", {
    listed: listed.labels.length,
    voidedThisRun: run.summary.voidedThisRunCount,
    voidedUsd: run.summary.voidedThisRunUsd,
    cracksUsd: run.summary.cracksUsd,
    buyerRefundsIssued: 0,
    truncated: run.truncated,
  })

  return { ok: true, data: snapshot, warnings }
}

async function trackForRecovery(
  labelId: string,
): Promise<{ scanned: boolean; statusCode: string | null } | null> {
  const tracked = await fetchShipEngineTrackingByLabelId(labelId)
  if (!tracked.ok) return null
  const detail = buildOrderTrackingDetailFromShipEngineData(tracked.payload)
  const statusCode = detail.status_code?.trim() || null
  return { scanned: shipEngineTrackingIndicatesPhysicalScan(detail), statusCode }
}

async function readForRecovery(
  labelId: string,
): Promise<{ voided: boolean; carrierId: string | null } | null> {
  const detail = await fetchLabelById(labelId)
  if (!detail.ok) return null
  return { voided: detail.label.voided, carrierId: detail.label.carrier_id }
}

async function voidForRecovery(
  labelId: string,
): Promise<{ ok: true; approved: boolean; message: string } | { ok: false; error: string }> {
  const voided = await voidShipEngineLabel(labelId)
  if (!voided.ok) return { ok: false, error: voided.error }
  return { ok: true, approved: voided.result.approved, message: voided.result.message }
}

async function clearTrackingForRecoveredLabels(
  supabase: SupabaseClient,
  rows: PostageAuditRow[],
): Promise<void> {
  const recovered = rows.filter(
    (row) => row.voidedThisRun && row.shipengineVoided && row.orderId && row.trackingNumber,
  )
  if (recovered.length === 0) return

  const orderIds = [...new Set(recovered.map((row) => row.orderId).filter((id): id is string => Boolean(id)))]
  const { data, error } = await supabase.from("orders").select("id, tracking_number").in("id", orderIds)
  if (error) {
    console.error("[postage recovery] load tracking before clear:", error.message)
    return
  }

  const current = new Map<string, string | null>()
  for (const row of data ?? []) {
    const r = row as { id: string; tracking_number: string | null }
    current.set(r.id, r.tracking_number)
  }

  for (const row of recovered) {
    if (!row.orderId || !row.trackingNumber) continue
    const onOrder = current.get(row.orderId)
    if (!onOrder || trackingKey(onOrder) !== trackingKey(row.trackingNumber)) continue
    const { error: upErr } = await supabase
      .from("orders")
      .update({
        tracking_number: null,
        tracking_carrier: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.orderId)
      .eq("tracking_number", onOrder)
    if (upErr) {
      console.error("[postage recovery] clear tracking:", row.orderId, upErr.message)
    }
  }
}
