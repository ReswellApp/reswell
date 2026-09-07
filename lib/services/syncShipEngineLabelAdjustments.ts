import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  downloadShipEngineAdjustmentReport,
  listShipEngineAdjustmentReports,
  parseShipEngineAdjustmentCsv,
  type ShipEngineAdjustmentReportMeta,
} from "@/lib/shipengine/adjustment-reports"
import { isShipEngineConfigured } from "@/lib/shipengine/config"
import { normalizeTrackingNumberForCarrier } from "@/lib/shipping/normalize-tracking-number"
import {
  dbListIngestedAdjustmentReportIds,
  dbResolveOrderIdsByTrackingNumbers,
  dbUpsertAdjustmentReport,
  dbUpsertLabelAdjustments,
} from "@/lib/db/shipengineLabelAdjustments"

export type SyncShipEngineAdjustmentsSummary = {
  reportsSeen: number
  reportsIngested: number
  rowsUpserted: number
  increasedRows: number
  skipped: number
}

function getServiceOrNull(): ReturnType<typeof createServiceRoleClient> | null {
  try {
    return createServiceRoleClient()
  } catch {
    return null
  }
}

async function ingestReport(
  supabase: ReturnType<typeof createServiceRoleClient>,
  report: ShipEngineAdjustmentReportMeta,
): Promise<{ rows: number; increased: number }> {
  const downloaded = await downloadShipEngineAdjustmentReport(report)
  if (!downloaded.ok) {
    throw new Error(downloaded.error)
  }

  const parsed = parseShipEngineAdjustmentCsv(downloaded.csv)
  const trackingNumbers = parsed
    .map((row) => row.trackingNumber)
    .filter((tn): tn is string => Boolean(tn))
  const orderByTracking = await dbResolveOrderIdsByTrackingNumbers(supabase, trackingNumbers)

  const withOrders = parsed.map((row) => {
    const key = row.trackingNumber
      ? normalizeTrackingNumberForCarrier(row.trackingNumber) || row.trackingNumber.trim()
      : ""
    return {
      ...row,
      orderId: key ? (orderByTracking.get(key) ?? null) : null,
    }
  })

  const reportWrite = await dbUpsertAdjustmentReport(supabase, {
    reportId: report.reportId,
    reportCreatedAt: report.createdAt,
    rowCount: withOrders.length,
  })
  if (reportWrite.error) throw reportWrite.error

  const rowsWrite = await dbUpsertLabelAdjustments(supabase, report.reportId, withOrders)
  if (rowsWrite.error) {
    await supabase.from("shipengine_adjustment_reports").delete().eq("report_id", report.reportId)
    throw rowsWrite.error
  }

  return {
    rows: withOrders.length,
    increased: withOrders.filter((row) => row.adjustmentAmountUsd > 0).length,
  }
}

/**
 * Pulls nightly ShipEngine adjustment reports and stores price-change rows.
 * Skips reports already ingested unless `force` is set.
 */
export async function syncShipEngineLabelAdjustments(opts?: {
  reportId?: string | null
  force?: boolean
}): Promise<
  { ok: true; summary: SyncShipEngineAdjustmentsSummary } | { ok: false; error: string }
> {
  if (!isShipEngineConfigured()) {
    return { ok: false, error: "ShipEngine is not configured" }
  }

  const supabase = getServiceOrNull()
  if (!supabase) {
    return { ok: false, error: "Server misconfigured" }
  }

  const listed = await listShipEngineAdjustmentReports()
  if (!listed.ok) return listed

  let reports = listed.reports
  if (opts?.reportId?.trim()) {
    const wanted = opts.reportId.trim()
    reports = reports.filter((report) => report.reportId === wanted)
    if (reports.length === 0) {
      reports = [{ reportId: wanted, createdAt: null, href: null }]
    }
  }

  const ingested = opts?.force
    ? { ids: new Set<string>(), error: null }
    : await dbListIngestedAdjustmentReportIds(supabase)
  if (ingested.error) {
    return { ok: false, error: ingested.error.message }
  }

  const summary: SyncShipEngineAdjustmentsSummary = {
    reportsSeen: reports.length,
    reportsIngested: 0,
    rowsUpserted: 0,
    increasedRows: 0,
    skipped: 0,
  }

  for (const report of reports) {
    if (ingested.ids.has(report.reportId)) {
      summary.skipped += 1
      continue
    }
    try {
      const result = await ingestReport(supabase, report)
      summary.reportsIngested += 1
      summary.rowsUpserted += result.rows
      summary.increasedRows += result.increased
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error("[syncShipEngineLabelAdjustments] report", report.reportId, msg)
      return { ok: false, error: msg }
    }
  }

  return { ok: true, summary }
}
