import type { PeerListingSection } from "@/lib/peer-listing-sections"
import type {
  BalanceSheetPeriod,
  BalanceSheetSort,
  BalanceSheetView,
} from "@/lib/validations/seller-balance-sheet"

export interface BalanceSheetEntryOrder {
  column: "purchase_price" | "sold_at" | "entry_key"
  ascending: boolean
  nullsFirst?: boolean
}

/** Blank purchase prices first, then lowest paid price. Date is the tiebreaker. */
export function balanceSheetEntryOrder(sort: BalanceSheetSort): BalanceSheetEntryOrder[] {
  if (sort === "missing-paid") {
    return [
      { column: "purchase_price", ascending: true, nullsFirst: true },
      { column: "sold_at", ascending: false },
      { column: "entry_key", ascending: false },
    ]
  }

  return [
    { column: "sold_at", ascending: false },
    { column: "entry_key", ascending: false },
  ]
}

/** UTC start of the selected P&L window, or null for all-time. */
export function balanceSheetPeriodStart(
  period: BalanceSheetPeriod,
  now: Date = new Date(),
): Date | null {
  if (period === "all") return null

  if (period === "month") {
    return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1))
  }

  const start = new Date(now.getTime())
  start.setUTCMonth(start.getUTCMonth() - 3)
  return start
}

export function balanceSheetPeriodLabel(period: BalanceSheetPeriod): string {
  if (period === "month") return "This month"
  if (period === "3m") return "Last 3 months"
  return "All time"
}

export function balanceSheetHref(input: {
  page?: number
  category?: PeerListingSection | null
  sort?: BalanceSheetSort
  view?: BalanceSheetView
  period?: BalanceSheetPeriod
}): string {
  const params = new URLSearchParams()
  if (input.page != null) params.set("page", String(input.page))
  if (input.category) params.set("category", input.category)
  if (input.sort === "missing-paid") params.set("sort", input.sort)
  if (input.view && input.view !== "all") params.set("view", input.view)
  if (input.period && input.period !== "all") params.set("period", input.period)
  const query = params.toString()
  return query ? `/dashboard/balance-sheet?${query}` : "/dashboard/balance-sheet"
}
