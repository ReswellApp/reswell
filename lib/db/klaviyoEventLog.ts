import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import type { SendKlaviyoServerEventInput, SendKlaviyoServerEventResult } from "@/lib/klaviyo/send-event"

/** Lifecycle category for a Klaviyo metric — drives grouping in the admin dashboard. */
export type KlaviyoMetricCategory =
  | "transactional"
  | "lifecycle"
  | "engagement"
  | "marketing"
  | "other"

const METRIC_CATEGORY: Record<string, KlaviyoMetricCategory> = {
  "Placed Order": "transactional",
  "Purchase Successful": "transactional",
  "Local Pickup Order Placed": "transactional",
  "Sale Successful": "transactional",
  "New Sale Received": "transactional",
  "Shipping Sale Received": "transactional",
  "Local Pickup Sale Received": "transactional",
  "Shipping Label Ready": "transactional",
  "Order Shipped": "transactional",
  "Order Shipping Update": "transactional",
  Payouts: "transactional",
  "New Account Created": "lifecycle",
  "User Inactive 3 Days": "lifecycle",
  "User Inactive 15 Days": "lifecycle",
  "User Inactive 30 Days": "lifecycle",
  "Review Requested": "lifecycle",
  "Checkout Started": "lifecycle",
  "Added to Cart": "lifecycle",
  "Offer Made": "engagement",
  "Seller Made Offer": "engagement",
  "Board Alert Match": "engagement",
  "Board Listing Request": "engagement",
  "Message Sent": "engagement",
  Listing: "engagement",
  "Favorites button": "engagement",
  "Listing Saved": "lifecycle",
  "Favorites Digest": "marketing",
  "Favorite Price Drop": "engagement",
  "Support Tickets": "engagement",
  "Support Tickets Response": "engagement",
  "Seller Reviewed Buyer": "engagement",
  Newsletter: "marketing",
  "Viewed Sell Page": "marketing",
  "Viewed Boards Page": "marketing",
  "Viewed Site Page": "marketing",
  "Search Insights Digest": "marketing",
}

export function categorizeKlaviyoMetric(metricName: string): KlaviyoMetricCategory {
  return METRIC_CATEGORY[metricName] ?? "other"
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

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------

export type NotificationsCenterRange = "24h" | "7d" | "30d" | "90d"

const RANGE_HOURS: Record<NotificationsCenterRange, number> = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
  "90d": 24 * 90,
}

export function isNotificationsCenterRange(value: unknown): value is NotificationsCenterRange {
  return value === "24h" || value === "7d" || value === "30d" || value === "90d"
}

export interface KlaviyoMetricRow {
  metric: string
  category: KlaviyoMetricCategory
  total: number
  sent: number
  skipped: number
  failed: number
  uniqueRecipients: number
}

export interface KlaviyoSkipReasonRow {
  reason: string
  count: number
}

export interface KlaviyoTopRecipientRow {
  identifier: string
  email: string | null
  count: number
  metrics: number
  sent: number
}

export interface TimelinePoint {
  bucket: string
  sent: number
  skipped: number
  failed: number
}

export interface KlaviyoRecentEvent {
  id: string
  metric: string
  status: "sent" | "skipped" | "failed"
  skipReason: string | null
  httpStatus: number | null
  email: string | null
  externalId: string | null
  createdAt: string
}

export interface InternalNotificationTypeRow {
  type: string
  count: number
  read: number
}

export interface NotificationsCenterAnalytics {
  range: NotificationsCenterRange
  since: string
  fetchedAt: string
  klaviyo: {
    totals: { total: number; sent: number; skipped: number; failed: number; uniqueRecipients: number }
    byMetric: KlaviyoMetricRow[]
    bySkipReason: KlaviyoSkipReasonRow[]
    timeline: TimelinePoint[]
    topRecipients: KlaviyoTopRecipientRow[]
    recent: KlaviyoRecentEvent[]
  }
  internal: {
    totals: { total: number; read: number; unread: number; uniqueUsers: number }
    byType: InternalNotificationTypeRow[]
    timeline: { bucket: string; count: number }[]
  }
}

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
  const hours = RANGE_HOURS[range]
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

  const byMetric: KlaviyoMetricRow[] = asRecordArray(k.byMetric).map((r) => ({
    metric: String(r.metric ?? ""),
    category: categorizeKlaviyoMetric(String(r.metric ?? "")),
    total: toNum(r.total),
    sent: toNum(r.sent),
    skipped: toNum(r.skipped),
    failed: toNum(r.failed),
    uniqueRecipients: toNum(r.uniqueRecipients),
  }))

  const bySkipReason: KlaviyoSkipReasonRow[] = asRecordArray(k.bySkipReason).map((r) => ({
    reason: String(r.reason ?? "Unknown"),
    count: toNum(r.count),
  }))

  const klaviyoTimeline: TimelinePoint[] = asRecordArray(k.timeline).map((r) => ({
    bucket: String(r.bucket ?? ""),
    sent: toNum(r.sent),
    skipped: toNum(r.skipped),
    failed: toNum(r.failed),
  }))

  const topRecipients: KlaviyoTopRecipientRow[] = asRecordArray(k.topRecipients).map((r) => ({
    identifier: String(r.identifier ?? ""),
    email: typeof r.email === "string" ? r.email : null,
    count: toNum(r.count),
    metrics: toNum(r.metrics),
    sent: toNum(r.sent),
  }))

  const recent: KlaviyoRecentEvent[] = (recentRes.data ?? []).map((r: Record<string, unknown>) => ({
    id: String(r.id),
    metric: String(r.metric_name ?? ""),
    status: (r.status as KlaviyoRecentEvent["status"]) ?? "sent",
    skipReason: typeof r.skip_reason === "string" ? r.skip_reason : null,
    httpStatus: r.http_status === null || r.http_status === undefined ? null : toNum(r.http_status),
    email: typeof r.profile_email === "string" ? r.profile_email : null,
    externalId: typeof r.profile_external_id === "string" ? r.profile_external_id : null,
    createdAt: String(r.created_at),
  }))

  const byType: InternalNotificationTypeRow[] = asRecordArray(i.byType).map((r) => ({
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
