/** Client-safe Klaviyo event log types and helpers (no server imports). */

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
  "User Inactive 30 Days": "lifecycle",
  "Review Requested": "lifecycle",
  "Checkout Started": "lifecycle",
  "Added to Cart": "lifecycle",
  "Offer Made": "engagement",
  "Seller Made Offer": "engagement",
  "Board Alert Match": "engagement",
  "Board Listing Request": "engagement",
  "Message Sent": "engagement",
  "Inactive Seller": "lifecycle",
  Listing: "engagement",
  "First Time Seller - Boards": "lifecycle",
  "First Time Seller - Fins": "lifecycle",
  "First Time Seller - Wetsuits": "lifecycle",
  "First Time Seller - Magazines": "lifecycle",
  "First Time Seller - Apparel": "lifecycle",
  "First Time Board Seller - Shipping Available": "lifecycle",
  "First Time Board Seller - Local Pickup": "lifecycle",
  "Favorites button": "engagement",
  "Listing Saved": "lifecycle",
  "Favorites Digest": "marketing",
  "Favorite Price Drop": "engagement",
  "Support Tickets": "engagement",
  "Support Tickets Response": "engagement",
  "Seller Reviewed Buyer": "engagement",
  Newsletter: "marketing",
  "Newsletter Promo Expiring": "marketing",
  "Viewed Sell Page": "marketing",
  "Viewed Boards Page": "marketing",
  "Viewed Site Page": "marketing",
  "Search Insights Digest": "marketing",
  "Platform Error Digest": "marketing",
  "Inactive Sync Report": "marketing",
  "Review Invite Sent": "lifecycle",
  "marked as sold": "engagement",
}

export const KNOWN_KLAVIYO_METRIC_NAMES = Object.keys(METRIC_CATEGORY)

export function categorizeKlaviyoMetric(metricName: string): KlaviyoMetricCategory {
  return METRIC_CATEGORY[metricName] ?? "other"
}

export type KlaviyoMetricCategoryFilter = KlaviyoMetricCategory | "all"

export const KLAVIYO_METRIC_CATEGORY_FILTERS: {
  value: KlaviyoMetricCategoryFilter
  label: string
}[] = [
  { value: "all", label: "All" },
  { value: "transactional", label: "Transactional" },
  { value: "lifecycle", label: "Lifecycle" },
  { value: "marketing", label: "Marketing" },
  { value: "engagement", label: "Engagement" },
  { value: "other", label: "Other" },
]

export function isKlaviyoMetricCategoryFilter(value: unknown): value is KlaviyoMetricCategoryFilter {
  return (
    value === "all" ||
    value === "transactional" ||
    value === "lifecycle" ||
    value === "engagement" ||
    value === "marketing" ||
    value === "other"
  )
}

export function klaviyoMetricsForCategoryFilter(
  category: KlaviyoMetricCategoryFilter,
): string[] | null {
  if (category === "all" || category === "other") return null
  return KNOWN_KLAVIYO_METRIC_NAMES.filter((metric) => METRIC_CATEGORY[metric] === category)
}

export function metricMatchesKlaviyoCategoryFilter(
  metricName: string,
  category: KlaviyoMetricCategoryFilter,
): boolean {
  if (category === "all") return true
  return categorizeKlaviyoMetric(metricName) === category
}

export type NotificationsCenterRange = "24h" | "7d" | "30d" | "90d"

export const NOTIFICATIONS_CENTER_RANGE_HOURS: Record<NotificationsCenterRange, number> = {
  "24h": 24,
  "7d": 24 * 7,
  "30d": 24 * 30,
  "90d": 24 * 90,
}

export function isNotificationsCenterRange(value: unknown): value is NotificationsCenterRange {
  return value === "24h" || value === "7d" || value === "30d" || value === "90d"
}

export type KlaviyoEventStatusFilter = "all" | "sent" | "skipped" | "failed"

export interface KlaviyoMetricRow {
  metric: string
  category: KlaviyoMetricCategory
  total: number
  sent: number
  skipped: number
  failed: number
  uniqueRecipients: number
}

function emptyKlaviyoMetricRow(metric: string): KlaviyoMetricRow {
  return {
    metric,
    category: categorizeKlaviyoMetric(metric),
    total: 0,
    sent: 0,
    skipped: 0,
    failed: 0,
    uniqueRecipients: 0,
  }
}

/**
 * Ensures every known metric appears in admin UI lists even when it had no events
 * in the selected window. Metrics with activity sort first; zero-count metrics follow.
 */
export function mergeKlaviyoMetricRows(
  byMetric: KlaviyoMetricRow[],
  category: KlaviyoMetricCategoryFilter,
): KlaviyoMetricRow[] {
  const statsByName = new Map(byMetric.map((m) => [m.metric, m]))

  if (category === "other") {
    return byMetric
      .filter((m) => m.category === "other")
      .sort((a, b) => b.total - a.total || a.metric.localeCompare(b.metric))
  }

  const metricNames = new Set<string>()

  if (category === "all") {
    for (const name of KNOWN_KLAVIYO_METRIC_NAMES) metricNames.add(name)
    for (const m of byMetric) metricNames.add(m.metric)
  } else {
    for (const name of klaviyoMetricsForCategoryFilter(category) ?? []) metricNames.add(name)
    for (const m of byMetric) {
      if (m.category === category) metricNames.add(m.metric)
    }
  }

  return [...metricNames]
    .map((name) => statsByName.get(name) ?? emptyKlaviyoMetricRow(name))
    .sort((a, b) => b.total - a.total || a.metric.localeCompare(b.metric))
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

export interface KlaviyoEventLogRow {
  id: string
  metric: string
  category: KlaviyoMetricCategory
  status: "sent" | "skipped" | "failed"
  skipReason: string | null
  httpStatus: number | null
  email: string | null
  externalId: string | null
  anonymousId: string | null
  uniqueId: string | null
  value: number | null
  valueCurrency: string | null
  properties: Record<string, unknown> | null
  detail: string | null
  createdAt: string
}

export interface KlaviyoRecipientMetricRow {
  metric: string
  category: KlaviyoMetricCategory
  count: number
  sent: number
  lastAt: string
}

export interface KlaviyoRecipientSummary {
  identifier: string
  email: string | null
  externalId: string | null
  total: number
  sent: number
  skipped: number
  failed: number
  metrics: KlaviyoRecipientMetricRow[]
}

export interface KlaviyoEventLogPageResult {
  range: NotificationsCenterRange
  since: string
  filters: {
    metric: string | null
    status: KlaviyoEventStatusFilter
    recipient: string | null
    category: KlaviyoMetricCategoryFilter
  }
  rows: KlaviyoEventLogRow[]
  total: number
  limit: number
  offset: number
  recipientSummary: KlaviyoRecipientSummary | null
}
