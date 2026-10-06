import type { PeerListingSection } from "@/lib/peer-listing-sections"
import type { BalanceSheetSort } from "@/lib/validations/seller-balance-sheet"

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

export function balanceSheetHref(input: {
  page?: number
  category?: PeerListingSection | null
  sort?: BalanceSheetSort
}): string {
  const params = new URLSearchParams()
  if (input.page != null) params.set("page", String(input.page))
  if (input.category) params.set("category", input.category)
  if (input.sort === "missing-paid") params.set("sort", input.sort)
  const query = params.toString()
  return query ? `/dashboard/balance-sheet?${query}` : "/dashboard/balance-sheet"
}
