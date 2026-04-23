export interface EarningsWalletSnapshot {
  id: string
  balance: string
  pending_balance?: string
  lifetime_earned: string
  lifetime_spent: string
  lifetime_cashed_out: string
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
}

export type EarningsActivityStatusFilter =
  | "all"
  | "available"
  | "pending"
  | "refund"
  | "cashout"
