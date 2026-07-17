import { fetchAdminSellFunnelDashboard } from "@/lib/db/sellFunnelAnalytics"
import type { SellFunnelAnalyticsDashboard } from "@/lib/types/sellFunnelAnalytics"
import type { SellFunnelAnalyticsQuery } from "@/lib/validations/sell-funnel-analytics"

export async function getSellFunnelAnalyticsForAdmin(
  query: SellFunnelAnalyticsQuery,
): Promise<{ ok: true; data: SellFunnelAnalyticsDashboard } | { ok: false; error: string }> {
  return fetchAdminSellFunnelDashboard({
    days: query.days,
    listingType: query.listingType,
  })
}
