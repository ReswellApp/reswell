import {
  getBusinessIntelligenceReport,
  getLatestBusinessIntelligenceReport,
  listBusinessIntelligenceReports,
  upsertBusinessIntelligenceReport,
} from "@/lib/db/businessIntelligenceReports"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"
import { buildBusinessIntelligenceSnapshot } from "@/lib/services/businessIntelligenceSnapshot"
import {
  businessIntelligenceModelId,
  generateBusinessIntelligenceBriefing,
  isBusinessIntelligenceLlmEnabled,
} from "@/lib/services/businessIntelligenceLlm"
import {
  loadAdminBusinessInsights,
  loadAdminMonthlyRevenueBreakdown,
} from "@/lib/services/adminBusinessInsights"
import { isGoogleAnalyticsConfigured, runGoogleAnalyticsReport } from "@/lib/services/googleAnalytics"
import { createServiceRoleClient } from "@/lib/supabase/server"
import type {
  BusinessIntelligenceReportListItem,
  BusinessIntelligenceReportRow,
  IntelligenceLiveDashboard,
  IntelligenceTopPath,
} from "@/lib/types/businessIntelligence"
import { BUSINESS_TIMEZONE, businessDayKeyFromMs } from "@/lib/utils/business-timezone"
import {
  defaultIntelligencePeriodKey,
  resolveIntelligencePeriod,
} from "@/lib/utils/businessIntelligencePeriod"
import type { BusinessIntelligencePeriodKind } from "@/lib/validations/businessIntelligence"

export type { IntelligenceLiveDashboard } from "@/lib/types/businessIntelligence"

/** Klaviyo metric — build a flow triggered on this name for admin digests. */
const DIGEST_METRIC = "Intelligence Report"

/** Comma/space/semicolon-separated admin recipients (`ADMIN_DIGEST_EMAILS`). */
function digestRecipients(): string[] {
  const raw = process.env.ADMIN_DIGEST_EMAILS ?? ""
  return Array.from(
    new Set(
      raw
        .split(/[,;\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => e.includes("@")),
    ),
  )
}

async function notifyIntelligenceAdmins(
  row: BusinessIntelligenceReportRow,
): Promise<{ sent: number; skipped: number }> {
  const recipients = digestRecipients()
  if (recipients.length === 0 || !row.report) {
    return { sent: 0, skipped: 0 }
  }

  let sent = 0
  let skipped = 0
  const properties = {
    period_kind: row.period_kind,
    period_key: row.period_key,
    period_start: row.period_start,
    period_end: row.period_end,
    generated_at: row.generated_at,
    model: row.model,
    executive_summary: row.report.executiveSummary,
    period_recap: row.report.periodRecap,
    recommendations: row.report.recommendations.slice(0, 8),
    risks: row.report.risks.slice(0, 6),
    opportunities: row.report.opportunities.slice(0, 6),
    watch_next_period: row.report.watchNextPeriod.slice(0, 6),
    dashboard_url: "/admin/intelligence",
  }

  for (const email of recipients) {
    const res = await sendKlaviyoServerEvent({
      metricName: DIGEST_METRIC,
      properties,
      profile: { email },
      uniqueId: `intelligence-report:${row.period_kind}:${row.period_key}:${email}`,
    })
    if (res.ok) sent += 1
    else skipped += 1
  }
  return { sent, skipped }
}

export async function loadIntelligenceDashboard(): Promise<IntelligenceLiveDashboard> {
  const db = createServiceRoleClient()

  const [insightsResult, monthlyResult, daily, weekly, monthly, archive, topPages] =
    await Promise.all([
      loadAdminBusinessInsights(),
      loadAdminMonthlyRevenueBreakdown(),
      getLatestBusinessIntelligenceReport(db, "daily"),
      getLatestBusinessIntelligenceReport(db, "weekly"),
      getLatestBusinessIntelligenceReport(db, "monthly"),
      listBusinessIntelligenceReports(db, { limit: 40 }),
      fetchLiveTopPages(),
    ])

  return {
    generatedAt: new Date().toISOString(),
    insights: insightsResult.ok ? insightsResult.data : null,
    insightsError: insightsResult.ok ? null : insightsResult.error,
    monthlyRevenue: monthlyResult.ok ? monthlyResult.data : [],
    monthlyRevenueError: monthlyResult.ok ? null : monthlyResult.error,
    topPages: topPages.pages,
    topPagesSource: topPages.source,
    latest: {
      daily: daily.row,
      weekly: weekly.row,
      monthly: monthly.row,
    },
    archive: archive.rows,
    llmEnabled: isBusinessIntelligenceLlmEnabled(),
  }
}

async function fetchLiveTopPages(): Promise<{
  pages: IntelligenceTopPath[]
  source: "ga4" | "none"
}> {
  if (!isGoogleAnalyticsConfigured()) return { pages: [], source: "none" }
  const end = new Date()
  const start = new Date(end.getTime() - 28 * 24 * 60 * 60 * 1000)
  const startDate = start.toISOString().slice(0, 10)
  const endDate = end.toISOString().slice(0, 10)
  const report = await runGoogleAnalyticsReport({
    dateRanges: [{ startDate, endDate }],
    dimensions: [{ name: "pagePath" }, { name: "pageTitle" }],
    metrics: [{ name: "screenPageViews" }, { name: "sessions" }],
    orderBys: [{ metric: { metricName: "screenPageViews" }, desc: true }],
    limit: 12,
  })
  if (!report.ok) return { pages: [], source: "none" }
  return {
    source: "ga4",
    pages: report.rows
      .map((row) => ({
        path: row.dimensionValues[0] ?? "",
        title: row.dimensionValues[1] ?? null,
        views: row.metricValues[0] ?? 0,
        sessions: row.metricValues[1] ?? 0,
      }))
      .filter((row) => row.path.length > 0 && !row.path.startsWith("/admin")),
  }
}

export async function generateAndStoreIntelligenceReport(input: {
  kind: BusinessIntelligencePeriodKind
  periodKey?: string
  force?: boolean
}): Promise<
  | { ok: true; data: BusinessIntelligenceReportRow; reused: boolean }
  | { ok: false; error: string }
> {
  try {
    const period = resolveIntelligencePeriod(input.kind, input.periodKey)
    const db = createServiceRoleClient()
    const existing = await getBusinessIntelligenceReport(db, period.kind, period.periodKey)
    if (existing.error) return { ok: false, error: existing.error.message }

    if (existing.row?.status === "complete" && existing.row.report && !input.force) {
      return { ok: true, data: existing.row, reused: true }
    }

    const generatedAt = new Date().toISOString()
    const model = businessIntelligenceModelId()
    const pending = await upsertBusinessIntelligenceReport(db, {
      periodKind: period.kind,
      periodKey: period.periodKey,
      periodStart: period.startDate,
      periodEnd: period.endDate,
      generatedAt,
      model,
      status: "generating",
      fromIso: period.fromIso,
      toIso: period.toIsoExclusive,
      snapshot: existing.row?.snapshot ?? {},
      report: null,
      error: null,
    })
    if (pending.error || !pending.row) {
      return { ok: false, error: pending.error?.message ?? "Could not start the report." }
    }

    const snapshot = await buildBusinessIntelligenceSnapshot(period)
    const briefing = await generateBusinessIntelligenceBriefing(snapshot)
    const saved = await upsertBusinessIntelligenceReport(db, {
      periodKind: period.kind,
      periodKey: period.periodKey,
      periodStart: period.startDate,
      periodEnd: period.endDate,
      generatedAt: new Date().toISOString(),
      model,
      status: "complete",
      fromIso: period.fromIso,
      toIso: period.toIsoExclusive,
      snapshot,
      report: briefing,
      error: null,
    })
    if (saved.error || !saved.row) {
      return { ok: false, error: saved.error?.message ?? "Could not save the report." }
    }
    return { ok: true, data: saved.row, reused: false }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Could not generate the intelligence report."
    try {
      const period = resolveIntelligencePeriod(input.kind, input.periodKey)
      const db = createServiceRoleClient()
      await upsertBusinessIntelligenceReport(db, {
        periodKind: period.kind,
        periodKey: period.periodKey,
        periodStart: period.startDate,
        periodEnd: period.endDate,
        generatedAt: new Date().toISOString(),
        model: businessIntelligenceModelId(),
        status: "failed",
        fromIso: period.fromIso,
        toIso: period.toIsoExclusive,
        snapshot: {},
        report: null,
        error: message,
      })
    } catch {
      // Keep the original error.
    }
    console.error("[business-intelligence]", message)
    return { ok: false, error: message }
  }
}

export async function runScheduledIntelligenceReports(nowMs = Date.now()): Promise<{
  generated: { kind: BusinessIntelligencePeriodKind; periodKey: string }[]
  skipped: { kind: BusinessIntelligencePeriodKind; periodKey: string; reason: string }[]
  failed: { kind: BusinessIntelligencePeriodKind; periodKey: string; error: string }[]
  notify: { sent: number; skipped: number }
}> {
  const generated: { kind: BusinessIntelligencePeriodKind; periodKey: string }[] = []
  const skipped: { kind: BusinessIntelligencePeriodKind; periodKey: string; reason: string }[] = []
  const failed: { kind: BusinessIntelligencePeriodKind; periodKey: string; error: string }[] = []
  const notify = { sent: 0, skipped: 0 }

  const todayDate = businessDayKeyFromMs(nowMs)
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone: BUSINESS_TIMEZONE,
    weekday: "short",
  }).format(new Date(nowMs))

  const jobs: { kind: BusinessIntelligencePeriodKind; periodKey: string }[] = [
    { kind: "daily", periodKey: defaultIntelligencePeriodKey("daily", nowMs) },
  ]
  if (weekday === "Mon") {
    jobs.push({ kind: "weekly", periodKey: defaultIntelligencePeriodKey("weekly", nowMs) })
  }
  if (todayDate.endsWith("-01")) {
    jobs.push({ kind: "monthly", periodKey: defaultIntelligencePeriodKey("monthly", nowMs) })
  }

  for (const job of jobs) {
    const result = await generateAndStoreIntelligenceReport({
      kind: job.kind,
      periodKey: job.periodKey,
      force: false,
    })
    if (!result.ok) {
      failed.push({ ...job, error: result.error })
    } else if (result.reused) {
      skipped.push({ ...job, reason: "already complete" })
    } else {
      generated.push(job)
      const notifyResult = await notifyIntelligenceAdmins(result.data)
      notify.sent += notifyResult.sent
      notify.skipped += notifyResult.skipped
    }
  }

  return { generated, skipped, failed, notify }
}
