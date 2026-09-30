const PAGE_VIEW_METRICS = new Set([
  "Viewed Site Page",
  "Viewed Product",
  "Viewed Sell Page",
])

/** Page views remain in Klaviyo and site traffic, but are not mirrored to Postgres. */
export function shouldRecordKlaviyoEventLog(metricName: string): boolean {
  return !PAGE_VIEW_METRICS.has(metricName.trim())
}
