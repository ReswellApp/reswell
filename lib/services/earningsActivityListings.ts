import type { SupabaseClient } from "@supabase/supabase-js"

import type { EarningsTransaction } from "@/components/features/earnings/earnings-types"
import { fetchEarningsListingsForOrderIds } from "@/lib/db/earningsActivityListings"
import { applyEarningsListingMap } from "@/lib/earnings-listing-map"
import {
  isLikelyOrderUuid,
  orderIdFromSellerSaleLedger,
} from "@/lib/earnings-sale-ledger"

export { applyEarningsListingMap } from "@/lib/earnings-listing-map"
export { saleHrefForOrderId } from "@/lib/earnings-sale-ledger"

export async function attachListingsToEarningsTransactions(
  supabase: SupabaseClient,
  transactions: EarningsTransaction[],
): Promise<EarningsTransaction[]> {
  const orderIds = transactions
    .map((tx) => orderIdFromSellerSaleLedger(tx))
    .filter((id): id is string => Boolean(id && isLikelyOrderUuid(id)))
  if (orderIds.length === 0) return transactions
  const byOrderId = await fetchEarningsListingsForOrderIds(supabase, orderIds)
  return applyEarningsListingMap(transactions, byOrderId)
}
