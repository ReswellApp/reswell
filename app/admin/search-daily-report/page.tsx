import { Suspense } from "react"
import { privatePageMetadata } from "@/lib/site-metadata"
import { SearchReportAdminShell } from "@/components/features/admin/search-report-admin-shell"

export const metadata = privatePageMetadata({
  title: "Search reports — Reswell admin",
  description:
    "Gemini briefings of daily, monthly, and all-time marketplace searches, dropdown picks, and empty-result demand.",
  path: "/admin/search-daily-report",
})

export default function AdminSearchDailyReportPage() {
  return (
    <>
      <h1 className="sr-only">Search reports</h1>
      <Suspense fallback={<p className="text-sm text-muted-foreground">Loading search reports…</p>}>
        <SearchReportAdminShell />
      </Suspense>
    </>
  )
}
