import { PnlAdminClient } from "@/components/features/admin/pnl/pnl-admin-client"
import { listPnlEntriesService } from "@/lib/services/pnl"
import { listLoansService } from "@/lib/services/pnlLoans"
import { privatePageMetadata } from "@/lib/site-metadata"
import { adminInsightsYearMonthSchema } from "@/lib/utils/adminInsightsPeriod"

export const metadata = privatePageMetadata({
  title: "P&L Tracker — Reswell",
  description: "Profit-and-loss ledger for buying and selling surfboards.",
  path: "/admin/pnl",
})

type AdminPnlPageProps = {
  searchParams: Promise<{ month?: string }>
}

export default async function AdminPnlPage({ searchParams }: AdminPnlPageProps) {
  const { month: monthParam } = await searchParams
  const parsedMonth = adminInsightsYearMonthSchema.safeParse(monthParam?.trim())
  const selectedYearMonth = parsedMonth.success ? parsedMonth.data : null

  const [entriesResult, loansResult] = await Promise.all([
    listPnlEntriesService(),
    listLoansService(),
  ])
  const entries = "data" in entriesResult ? entriesResult.data : []
  const loans = "data" in loansResult ? loansResult.data : []

  return (
    <PnlAdminClient
      initialEntries={entries}
      initialLoans={loans}
      selectedYearMonth={selectedYearMonth}
    />
  )
}
