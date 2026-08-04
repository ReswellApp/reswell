import { fetchAdminBrowseButtonClicksDashboard } from "@/lib/db/browseButtonAnalytics"
import type { BrowseButtonAnalyticsDashboard } from "@/lib/types/browseButtonAnalytics"
import type { BrowseButtonAnalyticsQuery } from "@/lib/validations/browse-button-analytics"

export async function getBrowseButtonAnalyticsForAdmin(
  query: BrowseButtonAnalyticsQuery,
): Promise<{ ok: true; data: BrowseButtonAnalyticsDashboard } | { ok: false; error: string }> {
  return fetchAdminBrowseButtonClicksDashboard({ days: query.days })
}
