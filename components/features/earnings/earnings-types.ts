import type { SellerEarningsDashboardTotals } from "@/lib/db/sellerEarningsTotals"

export interface EarningsWalletSnapshot {
  id: string
  balance: string
  pending_balance?: string
  lifetime_earned: string
  lifetime_spent: string
  lifetime_cashed_out: string
}

/** Server-rendered Earnings hub payload — no activity or balance-listing rows. */
export type EarningsHubInitialData =
  | {
      error: null
      wallet: EarningsWalletSnapshot
      sellerEarningsTotals: SellerEarningsDashboardTotals | null
      creditVisible: boolean
      creditBalanceUsd: number
    }
  | {
      error: "Unauthorized" | "Failed to create wallet"
      wallet: null
      sellerEarningsTotals: null
      creditVisible: false
      creditBalanceUsd: 0
    }

/** Listing tied to a seller sale ledger row (pending or available). */
export interface EarningsListingRef {
  id: string
  title: string
  href: string
  imageUrl: string | null
  extraListingCount: number
}

export interface EarningsTransaction {
  id: string
  type: "sale" | "purchase" | "cashout" | "deposit" | "refund"
  amount: string
  balance_after: string
  description: string
  status: string
  created_at: string
  reference_id?: string | null
  reference_type?: string | null
  listing?: EarningsListingRef | null
  saleHref?: string | null
  sellerEarningsUsd?: number | null
}

export type EarningsActivityStatusFilter =
  | "all"
  | "available"
  | "pending"
  | "refund"
  | "cashout"
