import { privatePageMetadata } from "@/lib/site-metadata"
import { SearchAnalyticsAdminClient } from "@/components/features/admin/search-analytics-admin-client"
import { LineChart } from "lucide-react"

export const metadata = privatePageMetadata({
  title: "Search analytics — Reswell admin",
  description:
    "Marketplace search volume, trending queries, zero-result terms, and Elasticsearch vs database fallback.",
  path: "/admin/search-analytics",
})

export default function AdminSearchAnalyticsPage() {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <LineChart className="h-8 w-8 text-neutral-800 dark:text-neutral-200" />
            Search analytics
          </h1>
          <p className="text-muted-foreground mt-1 max-w-3xl">
            Deep-dive dashboards for marketplace keyword search: volume, concentration, result mix, category
            scope, and zero-hit demand. Data lives in Elasticsearch.
          </p>
        </div>
      </div>
      <SearchAnalyticsAdminClient />
    </div>
  )
}
