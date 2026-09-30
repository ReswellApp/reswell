import { redirect } from "next/navigation"
import { z } from "zod"
import { AlertTriangle, ReceiptText } from "lucide-react"
import { BalanceSheetSummary } from "@/components/features/dashboard/balance-sheet-summary"
import { BalanceSheetTable } from "@/components/features/dashboard/balance-sheet-table"
import { DashboardPageHeader } from "@/components/features/dashboard/dashboard-page-header"
import { Card, CardContent } from "@/components/ui/card"
import {
  getAdminSellerBalanceSheet,
  SellerBalanceSheetAccessError,
} from "@/lib/services/sellerBalanceSheet"
import { privatePageMetadata } from "@/lib/site-metadata"

export const metadata = privatePageMetadata({
  title: "Balance Sheet — Reswell",
  description: "Your realized listing profit, derived from sales and listing cost basis.",
  path: "/dashboard/balance-sheet",
})

const pageSchema = z.coerce.number().int().positive().catch(1)
const PAGE_SIZE = 50

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>
}) {
  const params = await searchParams
  const requestedPage = pageSchema.parse(params.page)

  let sheet
  try {
    sheet = await getAdminSellerBalanceSheet(requestedPage, PAGE_SIZE)
  } catch (error) {
    if (error instanceof SellerBalanceSheetAccessError) {
      redirect("/dashboard")
    }
    throw error
  }

  if (requestedPage > sheet.totalPages) {
    redirect(`/dashboard/balance-sheet?page=${sheet.totalPages}`)
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Balance Sheet"
        description="Realized sales and profit update automatically from orders, refunds, and tipped off-platform sales."
      />

      <BalanceSheetSummary summary={sheet.summary} />

      {sheet.summary.missingCostBasis > 0 ? (
        <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
          <p>
            {sheet.summary.missingCostBasis} sold{" "}
            {sheet.summary.missingCostBasis === 1 ? "listing is" : "listings are"} missing a
            purchase price. Add it by editing the listing to calculate profit.
          </p>
        </div>
      ) : null}

      {sheet.entries.length > 0 ? (
        <BalanceSheetTable sheet={sheet} />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center py-14 text-center">
            <ReceiptText className="mb-4 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">No realized sales yet</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Confirmed Reswell sales appear here automatically. Off-platform sales appear after
              you mark the listing sold and leave a completed tip.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
