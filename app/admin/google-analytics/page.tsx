import { privatePageMetadata } from "@/lib/site-metadata"
import { getGoogleAnalyticsDashboardData } from "@/lib/services/googleAnalytics"
import { GoogleAnalyticsAdminClient } from "@/components/features/admin/google-analytics-admin-client"

export const dynamic = "force-dynamic"

export const metadata = privatePageMetadata({
  title: "Google Analytics — Admin — Reswell",
  description:
    "Site-wide GA4 sessions, traffic channels, partner embed iframe views, and outbound embed click events.",
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
          Site traffic, acquisition channels, and partner embed performance from GA4.
        </p>
      </div>
      <GoogleAnalyticsAdminClient initialData={initialData} />
    </div>
  )
}
