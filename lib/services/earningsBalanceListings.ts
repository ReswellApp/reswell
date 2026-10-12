import type { SupabaseClient } from "@supabase/supabase-js"

import type { EarningsTransaction } from "@/components/features/earnings/earnings-types"
import { fetchEarningsBalanceLedger } from "@/lib/db/earningsBalanceLedger"
import {
  allocateReadyBalanceRows,
  stillPendingBalanceRows,
  type EarningsBalanceListingRow,
} from "@/lib/earnings-balance-listings"
import { orderIdFromSellerSaleLedger } from "@/lib/earnings-sale-ledger"
import { attachListingsToEarningsTransactions } from "@/lib/services/earningsActivityListings"
import { resolveReversedSellerOrderIds } from "@/lib/services/earningsReversedOrders"

export interface EarningsBalanceListingsResult {
  pending: EarningsBalanceListingRow[]
  ready: EarningsBalanceListingRow[]
  reversedOrderIds: string[]
}

export async function getEarningsBalanceListings(
  supabase: SupabaseClient,
  input: {
    walletId: string
    sellerId: string
    readyBalanceUsd: number
  },
): Promise<EarningsBalanceListingsResult> {
  const ledger = await fetchEarningsBalanceLedger(supabase, input.walletId)
  const combined: EarningsTransaction[] = [...ledger.pending, ...ledger.released]
  const [withListings, reversedOrderIds] = await Promise.all([
    attachListingsToEarningsTransactions(supabase, combined),
    resolveReversedSellerOrderIds(supabase, input.sellerId, combined),
  ])

  const listingById = new Map(withListings.map((tx) => [tx.id, tx]))
  const pending = ledger.pending.map((tx) => listingById.get(tx.id) ?? tx)
  const released = ledger.released.map((tx) => listingById.get(tx.id) ?? tx)
  const reversed = new Set(reversedOrderIds)
  const releasedOrderIds = new Set(
    released
      .map((tx) => orderIdFromSellerSaleLedger(tx))
      .filter((id): id is string => Boolean(id)),
  )

  return {
    pending: stillPendingBalanceRows(pending, releasedOrderIds, reversed),
    ready: allocateReadyBalanceRows(released, reversed, input.readyBalanceUsd),
    reversedOrderIds,
  }
}
