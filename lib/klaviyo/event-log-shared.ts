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
