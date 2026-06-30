import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import type { SendKlaviyoServerEventInput, SendKlaviyoServerEventResult } from "@/lib/klaviyo/send-event"
import {
  categorizeKlaviyoMetric,
  KNOWN_KLAVIYO_METRIC_NAMES,
  klaviyoMetricsForCategoryFilter,
  NOTIFICATIONS_CENTER_RANGE_HOURS,
  type KlaviyoEventLogPageResult,
  type KlaviyoEventLogRow,
  type KlaviyoMetricCategoryFilter,
  type KlaviyoRecipientMetricRow,
  type KlaviyoRecipientSummary,
  type NotificationsCenterAnalytics,
  type NotificationsCenterRange,
} from "@/lib/klaviyo/event-log-shared"
import type { KlaviyoEventExplorerQuery } from "@/lib/validations/klaviyoEventExplorer"

export type {
  KlaviyoEventLogPageResult,
  KlaviyoEventLogRow,
  KlaviyoEventStatusFilter,
  KlaviyoMetricCategory,
  KlaviyoMetricCategoryFilter,
  KlaviyoMetricRow,
  KlaviyoRecentEvent,
  KlaviyoRecipientMetricRow,
  KlaviyoRecipientSummary,
  KlaviyoSkipReasonRow,
  KlaviyoTopRecipientRow,
  NotificationsCenterAnalytics,
  NotificationsCenterRange,
  TimelinePoint,
  InternalNotificationTypeRow,
} from "@/lib/klaviyo/event-log-shared"

export {
  categorizeKlaviyoMetric,
  isKlaviyoMetricCategoryFilter,
  isNotificationsCenterRange,
  KLAVIYO_METRIC_CATEGORY_FILTERS,
  klaviyoMetricsForCategoryFilter,
  metricMatchesKlaviyoCategoryFilter,
} from "@/lib/klaviyo/event-log-shared"

function quotedMetricInList(metrics: string[]): string {
  return `(${metrics.map((m) => `"${m.replace(/"/g, '\\"')}"`).join(",")})`
}

/** Applies category filter to a Supabase query on `klaviyo_event_log.metric_name`. */
function applyKlaviyoCategoryFilter<
  T extends {
    in(column: string, values: string[]): T
    not(column: string, operator: string, value: string): T
    eq(column: string, value: string): T
  },
>(query: T, category: KlaviyoMetricCategoryFilter): T {
  if (category === "all") return query

  if (category === "other") {
    if (KNOWN_KLAVIYO_METRIC_NAMES.length === 0) return query
    return query.not("metric_name", "in", quotedMetricInList(KNOWN_KLAVIYO_METRIC_NAMES))
  }

  const metrics = klaviyoMetricsForCategoryFilter(category)
  if (!metrics?.length) {
    return query.eq("metric_name", "__no_metrics_in_category__")
  }
  return query.in("metric_name", metrics)
}

/**
 * Best-effort, never-throwing insert of one Klaviyo event into the durable log.
 * Uses the service role so it works from cron, webhooks, and anonymous contexts.
 * A logging failure must never affect the Klaviyo send result.
 */
export async function recordKlaviyoEventLog(
  input: SendKlaviyoServerEventInput,
  result: SendKlaviyoServerEventResult,
): Promise<void> {
  try {
    const status: "sent" | "skipped" | "failed" = result.skipped
      ? "skipped"
      : result.ok
        ? "sent"
        : "failed"

    const supabase = createServiceRoleClient()
    await supabase.from("klaviyo_event_log").insert({
      metric_name: input.metricName,
      status,
      skip_reason: result.skipReason ?? null,
      http_status: result.status || null,
      profile_email: input.profile.email?.trim() || null,
      profile_external_id: input.profile.external_id?.trim() || null,
      profile_anonymous_id: input.profile.anonymous_id?.trim() || null,
      unique_id: input.uniqueId ?? null,
      value: typeof input.value === "number" && Number.isFinite(input.value) ? input.value : null,
      value_currency: input.value !== undefined ? (input.valueCurrency ?? "USD") : null,
      properties: input.properties ?? null,
      detail: result.detail ? result.detail.slice(0, 500) : null,
    })
  } catch (e) {
    console.error("[klaviyo] event log insert failed:", e instanceof Error ? e.message : e)
  }
}

const EVENT_LOG_SELECT =
  "id, metric_name, status, skip_reason, http_status, profile_email, profile_external_id, profile_anonymous_id, unique_id, value, value_currency, properties, detail, created_at"

function toNum(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function asRecordArray(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : []
}

/**
 * Loads the full notifications-center analytics payload.
 * `supabase` must be an authenticated staff client (RLS / RPC gate enforce staff).
 */
export async function fetchNotificationsCenterAnalytics(
  supabase: SupabaseClient,
  range: NotificationsCenterRange,
): Promise<NotificationsCenterAnalytics> {
  const hours = NOTIFICATIONS_CENTER_RANGE_HOURS[range]
  const since = new Date(Date.now() - hours * 60 * 60 * 1000)
  const sinceISO = since.toISOString()
  const bucket = range === "24h" ? "hour" : "day"

  const [klaviyoRpc, internalRpc, recentRes] = await Promise.all([
    supabase.rpc("klaviyo_event_log_analytics", { p_since: sinceISO, p_bucket: bucket }),
    supabase.rpc("internal_notifications_analytics", { p_since: sinceISO, p_bucket: bucket }),
    supabase
      .from("klaviyo_event_log")
      .select("id, metric_name, status, skip_reason, http_status, profile_email, profile_external_id, created_at")
      .order("created_at", { ascending: false })
      .limit(50),
  ])

  if (klaviyoRpc.error) throw new Error(klaviyoRpc.error.message)
  if (internalRpc.error) throw new Error(internalRpc.error.message)
  if (recentRes.error) throw new Error(recentRes.error.message)

  const k = (klaviyoRpc.data ?? {}) as Record<string, unknown>
  const i = (internalRpc.data ?? {}) as Record<string, unknown>
  const kTotals = (k.totals ?? {}) as Record<string, unknown>
  const iTotals = (i.totals ?? {}) as Record<string, unknown>

  const byMetric = asRecordArray(k.byMetric).map((r) => ({
    metric: String(r.metric ?? ""),
    category: categorizeKlaviyoMetric(String(r.metric ?? "")),
    total: toNum(r.total),
    sent: toNum(r.sent),
    skipped: toNum(r.skipped),
    failed: toNum(r.failed),
    uniqueRecipients: toNum(r.uniqueRecipients),
  }))

  const bySkipReason = asRecordArray(k.bySkipReason).map((r) => ({
    reason: String(r.reason ?? "Unknown"),
    count: toNum(r.count),
  }))

  const klaviyoTimeline = asRecordArray(k.timeline).map((r) => ({
    bucket: String(r.bucket ?? ""),
    sent: toNum(r.sent),
    skipped: toNum(r.skipped),
    failed: toNum(r.failed),
  }))

  const topRecipients = asRecordArray(k.topRecipients).map((r) => ({
    identifier: String(r.identifier ?? ""),
    email: typeof r.email === "string" ? r.email : null,
    count: toNum(r.count),
    metrics: toNum(r.metrics),
    sent: toNum(r.sent),
  }))

  const recent = (recentRes.data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    metric: String(r.metric_name ?? ""),
    status: (r.status as "sent" | "skipped" | "failed") ?? "sent",
    skipReason: typeof r.skip_reason === "string" ? r.skip_reason : null,
    httpStatus: r.http_status === null || r.http_status === undefined ? null : toNum(r.http_status),
    email: typeof r.profile_email === "string" ? r.profile_email : null,
    externalId: typeof r.profile_external_id === "string" ? r.profile_external_id : null,
    createdAt: String(r.created_at),
  }))

  const byType = asRecordArray(i.byType).map((r) => ({
    type: String(r.type ?? ""),
    count: toNum(r.count),
    read: toNum(r.read),
  }))

  const internalTimeline = asRecordArray(i.timeline).map((r) => ({
    bucket: String(r.bucket ?? ""),
    count: toNum(r.count),
  }))

  return {
    range,
    since: sinceISO,
    fetchedAt: new Date().toISOString(),
    klaviyo: {
      totals: {
        total: toNum(kTotals.total),
        sent: toNum(kTotals.sent),
        skipped: toNum(kTotals.skipped),
        failed: toNum(kTotals.failed),
        uniqueRecipients: toNum(kTotals.uniqueRecipients),
      },
      byMetric,
      bySkipReason,
      timeline: klaviyoTimeline,
      topRecipients,
      recent,
    },
    internal: {
      totals: {
        total: toNum(iTotals.total),
        read: toNum(iTotals.read),
        unread: toNum(iTotals.unread),
        uniqueUsers: toNum(iTotals.uniqueUsers),
      },
      byType,
      timeline: internalTimeline,
    },
  }
}

function sinceIsoForRange(range: NotificationsCenterRange): string {
  const hours = NOTIFICATIONS_CENTER_RANGE_HOURS[range]
  return new Date(Date.now() - hours * 60 * 60 * 1000).toISOString()
}

function mapEventLogRow(r: Record<string, unknown>): KlaviyoEventLogRow {
  const metric = String(r.metric_name ?? "")
  const rawProps = r.properties
  return {
    id: String(r.id),
    metric,
    category: categorizeKlaviyoMetric(metric),
    status: (r.status as KlaviyoEventLogRow["status"]) ?? "sent",
    skipReason: typeof r.skip_reason === "string" ? r.skip_reason : null,
    httpStatus: r.http_status === null || r.http_status === undefined ? null : toNum(r.http_status),
    email: typeof r.profile_email === "string" ? r.profile_email : null,
    externalId: typeof r.profile_external_id === "string" ? r.profile_external_id : null,
    anonymousId: typeof r.profile_anonymous_id === "string" ? r.profile_anonymous_id : null,
    uniqueId: typeof r.unique_id === "string" ? r.unique_id : null,
    value: r.value === null || r.value === undefined ? null : toNum(r.value),
    valueCurrency: typeof r.value_currency === "string" ? r.value_currency : null,
    properties:
      rawProps !== null && typeof rawProps === "object" && !Array.isArray(rawProps)
        ? (rawProps as Record<string, unknown>)
        : null,
    detail: typeof r.detail === "string" ? r.detail : null,
    createdAt: String(r.created_at),
  }
}

function sanitizeRecipientFilter(value: string): string {
  return value.trim().replace(/[,()]/g, "")
}

function recipientFilterOrClause(recipient: string): string | null {
  const safe = sanitizeRecipientFilter(recipient)
  if (!safe) return null
  if (safe.includes("@")) {
    return `profile_email.ilike.%${safe}%`
  }
  return `profile_external_id.eq.${safe},profile_anonymous_id.eq.${safe},profile_email.ilike.%${safe}%`
}

/**
 * Paginated Klaviyo event log for the admin explorer.
 * Staff RLS on `klaviyo_event_log` must allow SELECT.
 */
export async function fetchKlaviyoEventLogPage(
  supabase: SupabaseClient,
  query: KlaviyoEventExplorerQuery,
): Promise<KlaviyoEventLogPageResult> {
  const range = query.range
  const sinceISO = sinceIsoForRange(range)
  const metric = query.metric?.trim() || null
  const recipient = query.recipient?.trim() || null
  const status = query.status ?? "all"
  const category = query.category ?? "all"
  const limit = query.limit ?? 50
  const offset = query.offset ?? 0

  let listQuery = supabase
    .from("klaviyo_event_log")
    .select(EVENT_LOG_SELECT, { count: "exact" })
    .gte("created_at", sinceISO)
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1)

  listQuery = applyKlaviyoCategoryFilter(listQuery, category)
  if (metric) listQuery = listQuery.eq("metric_name", metric)
  if (status !== "all") listQuery = listQuery.eq("status", status)
  const recipientOr = recipient ? recipientFilterOrClause(recipient) : null
  if (recipientOr) listQuery = listQuery.or(recipientOr)

  const listRes = await listQuery
  if (listRes.error) throw new Error(listRes.error.message)

  const rows = (listRes.data ?? []).map((r) => mapEventLogRow(r as Record<string, unknown>))

  let recipientSummary: KlaviyoRecipientSummary | null = null
  if (recipient && recipientOr) {
    let summaryQuery = supabase
      .from("klaviyo_event_log")
      .select("metric_name, status, profile_email, profile_external_id, created_at")
      .gte("created_at", sinceISO)
      .order("created_at", { ascending: false })
      .limit(500)

    let countQuery = supabase
      .from("klaviyo_event_log")
      .select("id", { count: "exact", head: true })
      .gte("created_at", sinceISO)

    summaryQuery = applyKlaviyoCategoryFilter(summaryQuery, category)
    countQuery = applyKlaviyoCategoryFilter(countQuery, category)

    if (metric) {
      summaryQuery = summaryQuery.eq("metric_name", metric)
      countQuery = countQuery.eq("metric_name", metric)
    }
    if (status !== "all") {
      summaryQuery = summaryQuery.eq("status", status)
      countQuery = countQuery.eq("status", status)
    }
    summaryQuery = summaryQuery.or(recipientOr)
    countQuery = countQuery.or(recipientOr)

    const [summaryRes, countRes] = await Promise.all([summaryQuery, countQuery])
    const totalForRecipient = countRes.count ?? summaryRes.data?.length ?? 0

    if (!summaryRes.error && summaryRes.data?.length) {
      const byMetricMap = new Map<string, { count: number; sent: number; lastAt: string }>()
      let email: string | null = null
      let externalId: string | null = null
      let sent = 0
      let skipped = 0
      let failed = 0

      for (const raw of summaryRes.data) {
        const row = raw as Record<string, unknown>
        const m = String(row.metric_name ?? "")
        const st = String(row.status ?? "")
        const at = String(row.created_at ?? "")
        if (!email && typeof row.profile_email === "string") email = row.profile_email
        if (!externalId && typeof row.profile_external_id === "string") {
          externalId = row.profile_external_id
        }
        if (st === "sent") sent += 1
        else if (st === "skipped") skipped += 1
        else if (st === "failed") failed += 1

        const prev = byMetricMap.get(m)
        if (prev) {
          prev.count += 1
          if (st === "sent") prev.sent += 1
          if (at > prev.lastAt) prev.lastAt = at
        } else {
          byMetricMap.set(m, { count: 1, sent: st === "sent" ? 1 : 0, lastAt: at })
        }
      }

      const metrics: KlaviyoRecipientMetricRow[] = [...byMetricMap.entries()]
        .map(([m, stats]) => ({
          metric: m,
          category: categorizeKlaviyoMetric(m),
          count: stats.count,
          sent: stats.sent,
          lastAt: stats.lastAt,
        }))
        .sort((a, b) => b.count - a.count)

      recipientSummary = {
        identifier: recipient,
        email,
        externalId,
        total: totalForRecipient,
        sent,
        skipped,
        failed,
        metrics,
      }
    }
  }

  return {
    range,
    since: sinceISO,
    filters: { metric, status, recipient, category },
    rows,
    total: listRes.count ?? rows.length,
    limit,
    offset,
    recipientSummary,
  }
}
