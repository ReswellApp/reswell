"use server"

import { unstable_noStore as noStore } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { reconcileWalletAggregates, walletAggregateStrings } from "@/lib/wallet-reconcile"
import { EARNINGS_ACTIVITY_PAGE_SIZE } from "@/lib/earnings-activity-page-size"
import { resolveReversedSellerOrderIds } from "@/lib/services/earningsReversedOrders"

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
      reversedOrderIds: [] as string[],
      activityHasMore: false,
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
        reversedOrderIds: [],
        activityHasMore: false,
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

  const pageSize = clampActivityLimit(opts?.activityLimit ?? EARNINGS_ACTIVITY_PAGE_SIZE)
  const fetchThrough = pageSize // range(0, pageSize) inclusive → pageSize + 1 rows
  const { data: rawTx } = await supabase
    .from("wallet_transactions")
    .select("*")
    .eq("wallet_id", wallet.id)
    .order("created_at", { ascending: false })
    .range(0, fetchThrough)

  const batch = rawTx ?? []
  const activityHasMore = batch.length > pageSize
  const rows = activityHasMore ? batch.slice(0, pageSize) : batch
  const reversedOrderIds = await resolveReversedSellerOrderIds(supabase, user.id, rows)

  return {
    wallet,
    transactions: rows,
    reversedOrderIds,
    activityHasMore,
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

  const batch = rawTx ?? []
  const hasMore = batch.length > pageSize
  const rows = hasMore ? batch.slice(0, pageSize) : batch
  const reversedOrderIds = await resolveReversedSellerOrderIds(supabase, user.id, rows)

  return {
    error: null,
    transactions: rows,
    reversedOrderIds,
    hasMore,
  }
}
