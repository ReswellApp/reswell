"use server"

import { unstable_noStore as noStore } from "next/cache"
import type { EarningsTransaction } from "@/components/features/earnings/earnings-types"
import { createClient } from "@/lib/supabase/server"
import { reconcileWalletAggregates, walletAggregateStrings } from "@/lib/wallet-reconcile"
import { EARNINGS_ACTIVITY_PAGE_SIZE } from "@/lib/earnings-activity-page-size"
import { resolveReversedSellerOrderIds } from "@/lib/services/earningsReversedOrders"
import { attachListingsToEarningsTransactions } from "@/lib/services/earningsActivityListings"
import { getEarningsBalanceListings } from "@/lib/services/earningsBalanceListings"
import type { EarningsBalanceListingRow } from "@/lib/earnings-balance-listings"
import { getMySellerEarningsTotals } from "@/lib/db/sellerEarningsTotals"

const EARNINGS_ACTIVITY_MAX_PAGE = 50

function clampActivityLimit(n: number): number {
  return Math.min(Math.max(n, 1), EARNINGS_ACTIVITY_MAX_PAGE)
}

export async function getEarningsWalletData(opts?: { activityLimit?: number }) {
  noStore()
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
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

  let { data: wallet } = await supabase.from("wallets").select("*").eq("user_id", user.id).single()

  if (!wallet) {
    const { data: newWallet, error } = await supabase
      .from("wallets")
      .insert({ user_id: user.id })
      .select()
      .single()
    if (error) {
      return {
        error: "Failed to create wallet" as const,
        wallet: null,
        transactions: [],
        pendingBalanceListings: [],
        readyBalanceListings: [],
        reversedOrderIds: [],
        activityHasMore: false,
        sellerEarningsTotals: null,
      }
    }
    wallet = newWallet
  }

  const agg = reconcileWalletAggregates(wallet)
  if (agg.needsPersist) {
    const s = walletAggregateStrings(agg)
    await supabase
      .from("wallets")
      .update({
        balance: s.balance,
        pending_balance: s.pending_balance,
        lifetime_cashed_out: s.lifetime_cashed_out,
        updated_at: new Date().toISOString(),
      })
      .eq("id", wallet.id)
    wallet = {
      ...wallet,
      balance: s.balance,
      pending_balance: s.pending_balance,
      lifetime_cashed_out: s.lifetime_cashed_out,
    }
  }

  const readyBalanceUsd = parseFloat(String(wallet.balance ?? 0))

  const [sellerEarningsTotals, pageFetch, balanceListings] = await Promise.all([
    getMySellerEarningsTotals(supabase),
    (async () => {
      const pageSize = clampActivityLimit(opts?.activityLimit ?? EARNINGS_ACTIVITY_PAGE_SIZE)
      const fetchThrough = pageSize // range(0, pageSize) inclusive → pageSize + 1 rows
      const { data: rawTx } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("wallet_id", wallet.id)
        .order("created_at", { ascending: false })
        .range(0, fetchThrough)

      const batch = (rawTx ?? []) as EarningsTransaction[]
      const activityHasMore = batch.length > pageSize
      const rows = activityHasMore ? batch.slice(0, pageSize) : batch
      const [reversedOrderIds, withListings] = await Promise.all([
        resolveReversedSellerOrderIds(supabase, user.id, rows),
        attachListingsToEarningsTransactions(supabase, rows),
      ])
      return { rows: withListings, activityHasMore, reversedOrderIds }
    })(),
    getEarningsBalanceListings(supabase, {
      walletId: wallet.id,
      sellerId: user.id,
      readyBalanceUsd: Number.isFinite(readyBalanceUsd) ? readyBalanceUsd : 0,
    }),
  ])

  return {
    wallet,
    transactions: pageFetch.rows,
    pendingBalanceListings: balanceListings.pending,
    readyBalanceListings: balanceListings.ready,
    reversedOrderIds: [
      ...new Set([...pageFetch.reversedOrderIds, ...balanceListings.reversedOrderIds]),
    ],
    activityHasMore: pageFetch.activityHasMore,
    sellerEarningsTotals,
    paymentMethods: [] as unknown[],
    error: null,
  }
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
