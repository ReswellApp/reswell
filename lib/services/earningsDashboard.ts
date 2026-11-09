import type { SupabaseClient } from "@supabase/supabase-js"

import type {
  EarningsHubInitialData,
  EarningsTransaction,
  EarningsWalletSnapshot,
} from "@/components/features/earnings/earnings-types"
import { EARNINGS_ACTIVITY_PAGE_SIZE } from "@/lib/earnings-activity-page-size"
import type { EarningsBalanceListingRow } from "@/lib/earnings-balance-listings"
import { getMySellerEarningsTotals, type SellerEarningsDashboardTotals } from "@/lib/db/sellerEarningsTotals"
import { getOrCreateWalletForUser, type WalletRow } from "@/lib/db/wallets"
import { attachListingsToEarningsTransactions } from "@/lib/services/earningsActivityListings"
import { getEarningsBalanceListings } from "@/lib/services/earningsBalanceListings"
import { resolveReversedSellerOrderIds } from "@/lib/services/earningsReversedOrders"
import { getAdminReswellCreditHubSummary } from "@/lib/services/reswellCreditPilot"
import { persistWalletAggregatesIfNeeded } from "@/lib/services/walletReconcile"
import { earningsWalletSnapshotFromRow } from "@/lib/earnings-wallet-snapshot"
import { reconcileWalletAggregates, walletAggregateStrings } from "@/lib/wallet-reconcile"

const EARNINGS_ACTIVITY_MAX_PAGE = 50

export type EarningsHubSnapshot = Extract<EarningsHubInitialData, { error: null }>
export type EarningsHubFailure = Exclude<EarningsHubInitialData, { error: null }>

export type EarningsWalletBundle = {
  error: null
  wallet: EarningsWalletSnapshot
  transactions: EarningsTransaction[]
  pendingBalanceListings: EarningsBalanceListingRow[]
  readyBalanceListings: EarningsBalanceListingRow[]
  reversedOrderIds: string[]
  activityHasMore: boolean
  sellerEarningsTotals: SellerEarningsDashboardTotals | null
}

export type EarningsWalletBundleFailure = {
  error: "Unauthorized" | "Failed to create wallet"
  wallet: null
  transactions: EarningsTransaction[]
  pendingBalanceListings: EarningsBalanceListingRow[]
  readyBalanceListings: EarningsBalanceListingRow[]
  reversedOrderIds: string[]
  activityHasMore: false
  sellerEarningsTotals: null
}

function clampActivityLimit(n: number): number {
  return Math.min(Math.max(n, 1), EARNINGS_ACTIVITY_MAX_PAGE)
}

function emptyHubFailure(error: EarningsHubFailure["error"]): EarningsHubFailure {
  return {
    error,
    wallet: null,
    sellerEarningsTotals: null,
    creditVisible: false,
    creditBalanceUsd: 0,
  }
}

function emptyBundleFailure(error: EarningsWalletBundleFailure["error"]): EarningsWalletBundleFailure {
  return {
    error,
    wallet: null,
    transactions: [],
    pendingBalanceListings: [],
    readyBalanceListings: [],
    reversedOrderIds: [],
    activityHasMore: false,
    sellerEarningsTotals: null,
  }
}

async function loadReconciledWallet(
  supabase: SupabaseClient,
  userId: string,
): Promise<WalletRow | null> {
  const row = await getOrCreateWalletForUser(supabase, userId)
  if (!row) return null
  const agg = reconcileWalletAggregates(row)
  if (!agg.needsPersist) return row
  const s = walletAggregateStrings(agg)
  await persistWalletAggregatesIfNeeded(supabase, row)
  return {
    ...row,
    balance: s.balance,
    pending_balance: s.pending_balance,
    lifetime_cashed_out: s.lifetime_cashed_out,
  }
}

/**
 * Numbers for the default Earnings hub. Skips activity + balance-listing hydration
 * so `/dashboard/earnings` can paint without waiting on ~230 ledger rows.
 */
export async function getEarningsHubSnapshot(
  supabase: SupabaseClient,
  userId: string,
): Promise<EarningsHubSnapshot | EarningsHubFailure> {
  const [wallet, sellerEarningsTotals, credit] = await Promise.all([
    loadReconciledWallet(supabase, userId),
    getMySellerEarningsTotals(supabase),
    getAdminReswellCreditHubSummary(supabase, userId).catch(() => ({
      visible: false,
      balanceUsd: 0,
    })),
  ])

  if (!wallet) return emptyHubFailure("Failed to create wallet")

  return {
    error: null,
    wallet: earningsWalletSnapshotFromRow(wallet),
    sellerEarningsTotals,
    creditVisible: credit.visible,
    creditBalanceUsd: credit.balanceUsd,
  }
}

export async function getEarningsWalletBundle(
  supabase: SupabaseClient,
  userId: string,
  opts?: { activityLimit?: number },
): Promise<EarningsWalletBundle | EarningsWalletBundleFailure> {
  const wallet = await loadReconciledWallet(supabase, userId)
  if (!wallet) return emptyBundleFailure("Failed to create wallet")

  const readyBalanceUsd = parseFloat(String(wallet.balance ?? 0))
  const pageSize = clampActivityLimit(opts?.activityLimit ?? EARNINGS_ACTIVITY_PAGE_SIZE)
  const fetchThrough = pageSize

  const [sellerEarningsTotals, pageFetch, balanceListings] = await Promise.all([
    getMySellerEarningsTotals(supabase),
    (async () => {
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
        resolveReversedSellerOrderIds(supabase, userId, rows),
        attachListingsToEarningsTransactions(supabase, rows),
      ])
      return { rows: withListings, activityHasMore, reversedOrderIds }
    })(),
    getEarningsBalanceListings(supabase, {
      walletId: wallet.id,
      sellerId: userId,
      readyBalanceUsd: Number.isFinite(readyBalanceUsd) ? readyBalanceUsd : 0,
    }),
  ])

  return {
    error: null,
    wallet: earningsWalletSnapshotFromRow(wallet),
    transactions: pageFetch.rows,
    pendingBalanceListings: balanceListings.pending,
    readyBalanceListings: balanceListings.ready,
    reversedOrderIds: [
      ...new Set([...pageFetch.reversedOrderIds, ...balanceListings.reversedOrderIds]),
    ],
    activityHasMore: pageFetch.activityHasMore,
    sellerEarningsTotals,
  }
}
