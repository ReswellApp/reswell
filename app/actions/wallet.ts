"use server"

import { unstable_noStore as noStore } from "next/cache"
import type { EarningsTransaction } from "@/components/features/earnings/earnings-types"
import { createClient } from "@/lib/supabase/server"
import { EARNINGS_ACTIVITY_PAGE_SIZE } from "@/lib/earnings-activity-page-size"
import { resolveReversedSellerOrderIds } from "@/lib/services/earningsReversedOrders"
import { attachListingsToEarningsTransactions } from "@/lib/services/earningsActivityListings"
import type { EarningsBalanceListingRow } from "@/lib/earnings-balance-listings"
import { getEarningsWalletBundle } from "@/lib/services/earningsDashboard"

const EARNINGS_ACTIVITY_MAX_PAGE = 50

function clampActivityLimit(n: number): number {
  return Math.min(Math.max(n, 1), EARNINGS_ACTIVITY_MAX_PAGE)
}

function unauthorizedBundle() {
  return {
    error: "Unauthorized" as const,
    wallet: null,
    transactions: [] as unknown[],
    pendingBalanceListings: [] as EarningsBalanceListingRow[],
    readyBalanceListings: [] as EarningsBalanceListingRow[],
    reversedOrderIds: [] as string[],
    activityHasMore: false,
    sellerEarningsTotals: null,
  }
}

export async function getEarningsWalletData(opts?: { activityLimit?: number }) {
  noStore()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) return unauthorizedBundle()

  return getEarningsWalletBundle(supabase, user.id, opts)
}

export async function loadMoreEarningsActivity(params: { offset: number; limit?: number }) {
  noStore()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      error: "Unauthorized" as const,
      transactions: [] as unknown[],
      reversedOrderIds: [] as string[],
      hasMore: false,
    }
  }


  const { data: wallet } = await supabase.from("wallets").select("id").eq("user_id", user.id).single()
  if (!wallet?.id) {
    return { error: "No wallet" as const, transactions: [], reversedOrderIds: [], hasMore: false }
  }

  const pageSize = clampActivityLimit(params.limit ?? EARNINGS_ACTIVITY_PAGE_SIZE)
  const offset = Math.max(0, params.offset)
  const end = offset + pageSize

  const { data: rawTx } = await supabase
    .from("wallet_transactions")
    .select("*")
    .eq("wallet_id", wallet.id)
    .order("created_at", { ascending: false })
    .range(offset, end)

  const batch = (rawTx ?? []) as EarningsTransaction[]
  const hasMore = batch.length > pageSize
  const rows = hasMore ? batch.slice(0, pageSize) : batch
  const [reversedOrderIds, withListings] = await Promise.all([
    resolveReversedSellerOrderIds(supabase, user.id, rows),
    attachListingsToEarningsTransactions(supabase, rows),
  ])

  return {
    error: null,
    transactions: withListings,
    reversedOrderIds,
    hasMore,
  }
}
