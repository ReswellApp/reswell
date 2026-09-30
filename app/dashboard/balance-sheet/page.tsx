import { redirect } from "next/navigation"
import { z } from "zod"
import { AlertTriangle, ReceiptText } from "lucide-react"
import { BalanceSheetCategoryFilter } from "@/components/features/dashboard/balance-sheet-category-filter"
import { BalanceSheetSummary } from "@/components/features/dashboard/balance-sheet-summary"
import { BalanceSheetTable } from "@/components/features/dashboard/balance-sheet-table"
import { DashboardPageHeader } from "@/components/features/dashboard/dashboard-page-header"
import { Card, CardContent } from "@/components/ui/card"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
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
  searchParams: Promise<{ page?: string; category?: string }>
}) {
  const params = await searchParams
  const requestedPage = pageSchema.parse(params.page)
  const category = isPeerListingSection(params.category) ? params.category : null

  let sheet
  try {
    sheet = await getAdminSellerBalanceSheet(requestedPage, PAGE_SIZE, category)
  } catch (error) {
    if (error instanceof SellerBalanceSheetAccessError) {
      redirect("/dashboard")
    }
    throw error
  }

  if (requestedPage > sheet.totalPages) {
    const redirectParams = new URLSearchParams({ page: String(sheet.totalPages) })
    if (category) redirectParams.set("category", category)
    redirect(`/dashboard/balance-sheet?${redirectParams.toString()}`)
  }

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Balance Sheet"
        description="Inventory, realized sales, and profit update automatically from listings, orders, refunds, and tipped off-platform sales."
      />

      <div className="flex justify-end">
        <BalanceSheetCategoryFilter category={category} />
      </div>

      <BalanceSheetSummary summary={sheet.summary} />

      {sheet.summary.missingCostBasis > 0 ? (
        <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
          <p>
            {sheet.summary.missingCostBasis}{" "}
            {sheet.summary.missingCostBasis === 1 ? "listing is" : "listings are"} missing a
            purchase price. Add it by editing the listing to complete its cost basis and calculate
            profit after a sale.
          </p>
        </div>
      ) : null}

      {sheet.entries.length > 0 ? (
        <BalanceSheetTable sheet={sheet} category={category} />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center py-14 text-center">
            <ReceiptText className="mb-4 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">
              {category ? "No listings in this category" : "No balance sheet listings yet"}
            </p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Active inventory and confirmed Reswell sales appear automatically. Off-platform
              sales appear after you mark the listing sold and leave a completed tip.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
