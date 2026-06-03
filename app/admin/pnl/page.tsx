import { PnlAdminClient } from "@/components/features/admin/pnl/pnl-admin-client"
import { listPnlEntriesService } from "@/lib/services/pnl"
import { listLoansService } from "@/lib/services/pnlLoans"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "P&L Tracker — Reswell",
  description: "Profit-and-loss ledger for buying and selling surfboards.",
  path: "/admin/pnl",
})

export default async function AdminPnlPage() {
  const [entriesResult, loansResult] = await Promise.all([
    listPnlEntriesService(),
    listLoansService(),
  ])
  const entries = "data" in entriesResult ? entriesResult.data : []
  const loans = "data" in loansResult ? loansResult.data : []

  return <PnlAdminClient initialEntries={entries} initialLoans={loans} />
}
