import { privatePageMetadata } from "@/lib/site-metadata"
import { SearchAnalyticsAdminClient } from "@/components/features/admin/search-analytics-admin-client"

export const metadata = privatePageMetadata({
  title: "Search analytics — Reswell admin",
  description:
    "Daily, weekly, and all-time marketplace searches — plus the terms buyers look for most, so we can source boards we may not have.",
  path: "/admin/search-analytics",
})

export default function AdminSearchAnalyticsPage() {
  return (
    <>
      <h1 className="sr-only">Search analytics</h1>
      <SearchAnalyticsAdminClient />
    </>
  )
}
