import { getSearchAnalyticsDashboardService } from "@/lib/services/searchAnalytics"
import { sendKlaviyoServerEvent } from "@/lib/klaviyo/send-event"

const DIGEST_METRIC = "Search Insights Digest"
const MAX_INSIGHTS_IN_DIGEST = 12

export type SearchInsightsDigestResult = {
  sent: number
  skipped: number
  recipients: number
  insightCount: number
  rangeDays: number
}

/** Comma/space/semicolon-separated admin recipients for the digest. */
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

/**
 * Composes a digest of the most pressing search insights (critical + warning)
 * and fires a Klaviyo event per admin recipient so the team can act without
 * opening the dashboard. Build a Klaviyo flow off the "Search Insights Digest" metric.
 */
export async function runSearchInsightsDigest(
  rangeDays = 7,
): Promise<SearchInsightsDigestResult> {
  const recipients = digestRecipients()
  const dashboard = await getSearchAnalyticsDashboardService(rangeDays)

  const pressing = dashboard.insights
    .filter((i) => i.severity === "critical" || i.severity === "warning")
    .slice(0, MAX_INSIGHTS_IN_DIGEST)

  const result: SearchInsightsDigestResult = {
    sent: 0,
    skipped: 0,
    recipients: recipients.length,
    insightCount: pressing.length,
    rangeDays,
  }

  // Nothing pressing, or no one to tell — exit quietly (still a successful run).
  if (pressing.length === 0 || recipients.length === 0) {
    return result
  }

  const dayKey = new Date().toISOString().slice(0, 10)
  const properties = {
    range_days: rangeDays,
    generated_at: dashboard.fetchedAt,
    total_searches: dashboard.totalSearches,
    zero_result_share: dashboard.zeroResultSearchShare,
    actionable_count: dashboard.headline.actionableInsightCount,
    captured_demand_total: dashboard.demandCapture.total,
    insights: pressing.map((i) => ({
      id: i.id,
      severity: i.severity,
      category: i.category,
      title: i.title,
      finding: i.finding,
      action: i.action,
      metric: i.metricValue ?? null,
      examples: (i.examples ?? []).slice(0, 5),
    })),
    dashboard_url: "/admin/search-analytics",
  }

  for (const email of recipients) {
    const res = await sendKlaviyoServerEvent({
      metricName: DIGEST_METRIC,
      properties,
      profile: { email },
      uniqueId: `search-insights-digest:${dayKey}:${email}`,
    })
    if (res.ok) result.sent += 1
    else result.skipped += 1
  }

  return result
}
