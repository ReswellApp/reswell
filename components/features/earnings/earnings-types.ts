export interface EarningsWalletSnapshot {
  id: string
  balance: string
  pending_balance?: string
  lifetime_earned: string
  lifetime_spent: string
  lifetime_cashed_out: string
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
