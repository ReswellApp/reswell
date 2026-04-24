import { privatePageMetadata } from "@/lib/site-metadata"
import { SearchAnalyticsAdminClient } from "@/components/features/admin/search-analytics-admin-client"

export const metadata = privatePageMetadata({
  title: "Search analytics — Reswell admin",
  description:
    "Marketplace search volume, typeahead dropdown picks, trending queries, zero-result terms, and Elasticsearch vs database mix.",
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
