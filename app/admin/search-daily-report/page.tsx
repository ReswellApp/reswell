import { privatePageMetadata } from "@/lib/site-metadata"
import { SearchDailyReportAdminClient } from "@/components/features/admin/search-daily-report-admin-client"

export const metadata = privatePageMetadata({
  title: "Search daily report — Reswell admin",
  description:
    "Gemini briefing of each day's marketplace searches, dropdown picks, and empty-result demand.",
  path: "/admin/search-daily-report",
})

export default function AdminSearchDailyReportPage() {
  return (
    <>
      <h1 className="sr-only">Search daily report</h1>
      <SearchDailyReportAdminClient />
    </>
  )
}
