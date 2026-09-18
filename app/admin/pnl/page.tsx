import { PnlAdminClient } from "@/components/features/admin/pnl/pnl-admin-client"
import { listPnlEntriesService } from "@/lib/services/pnl"
import { privatePageMetadata } from "@/lib/site-metadata"
import { adminInsightsYearMonthSchema } from "@/lib/utils/adminInsightsPeriod"

export const metadata = privatePageMetadata({
  title: "Balance Sheet — Reswell",
  description: "Inventory balance sheet for boards bought on Reswell or outside.",
  path: "/admin/pnl",
})

type AdminPnlPageProps = {
  searchParams: Promise<{ month?: string }>
}

export default async function AdminPnlPage({ searchParams }: AdminPnlPageProps) {
  const { month: monthParam } = await searchParams
  const parsedMonth = adminInsightsYearMonthSchema.safeParse(monthParam?.trim())
  const selectedYearMonth = parsedMonth.success ? parsedMonth.data : null

  const entriesResult = await listPnlEntriesService()
  const entries = "data" in entriesResult ? entriesResult.data : []

  return (
    <PnlAdminClient
      initialEntries={entries}
      selectedYearMonth={selectedYearMonth}
    />
  )
}
