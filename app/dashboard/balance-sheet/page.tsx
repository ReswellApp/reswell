import Link from "next/link"
import { redirect } from "next/navigation"
import { z } from "zod"
import { AlertTriangle, ReceiptText } from "lucide-react"
import { BalanceSheetCategoryFilter } from "@/components/features/dashboard/balance-sheet-category-filter"
import { BalanceSheetPeriodSelect } from "@/components/features/dashboard/balance-sheet-period-select"
import { BalanceSheetSortSelect } from "@/components/features/dashboard/balance-sheet-sort-select"
import { BalanceSheetSummary } from "@/components/features/dashboard/balance-sheet-summary"
import { BalanceSheetTable } from "@/components/features/dashboard/balance-sheet-table"
import { BalanceSheetViewTabs } from "@/components/features/dashboard/balance-sheet-view-tabs"
import { DashboardPageHeader } from "@/components/features/dashboard/dashboard-page-header"
import { Card, CardContent } from "@/components/ui/card"
import { isPeerListingSection } from "@/lib/peer-listing-sections"
import {
  getAdminSellerBalanceSheet,
  SellerBalanceSheetAccessError,
} from "@/lib/services/sellerBalanceSheet"
import { privatePageMetadata } from "@/lib/site-metadata"
import {
  balanceSheetHref,
  balanceSheetPeriodLabel,
} from "@/lib/utils/balance-sheet-query"
import {
  balanceSheetPeriodSchema,
  balanceSheetSortSchema,
  balanceSheetViewSchema,
} from "@/lib/validations/seller-balance-sheet"

export const metadata = privatePageMetadata({
  title: "Balance Sheet — Reswell",
  description: "Track active inventory, sold flips, and monthly realized profit.",
  path: "/dashboard/balance-sheet",
})

const pageSchema = z.coerce.number().int().positive().catch(1)
const PAGE_SIZE = 50

export default async function BalanceSheetPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    category?: string
    sort?: string
    view?: string
    period?: string
  }>
}) {
  const params = await searchParams
  const requestedPage = pageSchema.parse(params.page)
  const category = isPeerListingSection(params.category) ? params.category : null
  const sort = balanceSheetSortSchema.parse(params.sort)
  const view = balanceSheetViewSchema.parse(params.view)
  const period = balanceSheetPeriodSchema.parse(params.period)

  let sheet
  try {
    sheet = await getAdminSellerBalanceSheet(
      requestedPage,
      PAGE_SIZE,
      category,
      sort,
      view,
      period,
    )
  } catch (error) {
    if (error instanceof SellerBalanceSheetAccessError) {
      redirect("/dashboard/listings")
    }
    throw error
  }

  if (requestedPage > sheet.totalPages) {
    redirect(balanceSheetHref({ page: sheet.totalPages, category, sort, view, period }))
  }

  const emptyTitle =
    view === "active"
      ? category
        ? "No active inventory in this category"
        : "No active inventory"
      : view === "sold"
        ? period === "all"
          ? category
            ? "No sold listings in this category"
            : "No sold listings yet"
          : `No sales in ${balanceSheetPeriodLabel(period).toLowerCase()}`
        : category
          ? "No listings in this category"
          : "No balance sheet listings yet"

  return (
    <div className="space-y-6">
      <DashboardPageHeader
        title="Balance Sheet"
        description="Track what you have listed, what sold, and what you actually made after fees and cost basis."
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <BalanceSheetViewTabs
          view={view}
          activeCount={sheet.summary.inventoryListings}
          soldCount={sheet.summary.realizedSales}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <BalanceSheetPeriodSelect period={period} />
          <BalanceSheetSortSelect sort={sort} />
          <BalanceSheetCategoryFilter category={category} />
        </div>
      </div>

      <BalanceSheetSummary summary={sheet.summary} period={period} />

      {sheet.summary.missingCostBasis > 0 ? (
        <div className="flex gap-3 rounded-lg border border-amber-500/30 bg-amber-500/[0.06] p-4 text-sm">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" />
          <p>
            {sheet.summary.missingCostBasis}{" "}
            {sheet.summary.missingCostBasis === 1 ? "listing is" : "listings are"} missing a
            purchase price. Add it by editing the listing to complete its cost basis and calculate
            profit after a sale.{" "}
            {sort === "missing-paid" ? (
              "Missing paid prices are listed first."
            ) : (
              <Link
                href={balanceSheetHref({ category, sort: "missing-paid", view, period })}
                className="font-medium text-foreground underline underline-offset-2"
              >
                Sort by missing paid price.
              </Link>
            )}
          </p>
        </div>
      ) : null}

      {sheet.entries.length > 0 ? (
        <BalanceSheetTable
          sheet={sheet}
          category={category}
          sort={sort}
          view={view}
          period={period}
        />
      ) : (
        <Card>
          <CardContent className="flex flex-col items-center py-14 text-center">
            <ReceiptText className="mb-4 h-10 w-10 text-muted-foreground" />
            <p className="font-medium">{emptyTitle}</p>
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
