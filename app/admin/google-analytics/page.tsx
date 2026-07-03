import { privatePageMetadata } from "@/lib/site-metadata"
import { getGoogleAnalyticsDashboardData } from "@/lib/services/googleAnalytics"
import { GoogleAnalyticsAdminClient } from "@/components/features/admin/google-analytics-admin-client"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Google Analytics — Admin — Reswell",
  description:
    "PRO GA4 intelligence: period-over-period KPIs, realtime users, acquisition, partner embed CTR, referrers, listing pages, and event analytics.",
  path: "/admin/google-analytics",
})

const DEFAULT_RANGE_DAYS = 28

export default async function AdminGoogleAnalyticsPage() {
  const initialData = await getGoogleAnalyticsDashboardData({ days: DEFAULT_RANGE_DAYS })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Google Analytics</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Site traffic, acquisition, listing pages, and partner embed performance — with period-over-period deltas and realtime users.
        </p>
      </div>
      <GoogleAnalyticsAdminClient initialData={initialData} />
    </div>
  )
}
