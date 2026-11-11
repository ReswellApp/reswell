import type { EarningsWalletSnapshot } from "@/components/features/earnings/earnings-types"
import type { WalletRow } from "@/lib/db/wallets"

function moneyString(value: string | number | null | undefined): string {
  const amount = typeof value === "number" ? value : parseFloat(String(value ?? "0"))
  return Number.isFinite(amount) ? amount.toFixed(2) : "0.00"
}

export function earningsWalletSnapshotFromRow(row: WalletRow): EarningsWalletSnapshot {
  return {
    id: row.id,
    balance: moneyString(row.balance),
    pending_balance: moneyString(row.pending_balance),
    lifetime_earned: moneyString(row.lifetime_earned),
    lifetime_spent: moneyString(row.lifetime_spent),
    lifetime_cashed_out: moneyString(row.lifetime_cashed_out),
  }
}
