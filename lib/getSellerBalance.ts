/**
 * Single source of truth for seller balance.
 * All balance displays across the site should use this function.
 * Source: wallets table (tracks earnings from marketplace sales).
 */

import { SupabaseClient } from "@supabase/supabase-js"
import { reconcileWalletAggregates, spendableReswellBucks } from "./wallet-reconcile"

export type WalletBalanceDbRow = {
  id: string
  balance: string | number | null
  pending_balance: string | number | null
  lifetime_earned: string | number | null
  lifetime_spent: string | number | null
  lifetime_cashed_out: string | number | null
}

function parseMoney(v: string | number | null | undefined): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

/** Admin ops: the numbers stored on the wallet row — do not reconcile away credits. */
export function summarizeStoredWalletBalanceRow(wallet: WalletBalanceDbRow | null) {
  if (!wallet) {
    return summarizeWalletBalanceRow(null)
  }

  const balance = parseMoney(wallet.balance)
  const pending = Math.max(0, parseMoney(wallet.pending_balance))
  const owed = balance < 0 ? -balance : 0

  return {
    balance: Math.max(0, balance),
    pendingBalance: pending,
    totalBalance: Math.round((balance + pending) * 100) / 100,
    lifetime_earned: parseMoney(wallet.lifetime_earned),
    lifetime_spent: parseMoney(wallet.lifetime_spent),
    lifetime_cashed_out: Math.max(0, parseMoney(wallet.lifetime_cashed_out)),
    spendableBucks: Math.max(0, balance),
    inWalletOwed: owed,
    walletId: wallet.id,
  }
}

export function summarizeWalletBalanceRow(wallet: WalletBalanceDbRow | null) {
  if (!wallet) {
    return {
      balance: 0,
      pendingBalance: 0,
      totalBalance: 0,
      lifetime_earned: 0,
      lifetime_spent: 0,
      lifetime_cashed_out: 0,
      /** In-wallet Reswell that can be spent or cashed (never negative in this shape). */
      spendableBucks: 0,
      /** Amount owed the platform in-wallet (refunds after cash-out, etc.); 0 if none. */
      inWalletOwed: 0,
      walletId: null as string | null,
    }
  }

  const r = reconcileWalletAggregates(wallet)
  const owed = r.balance < 0 ? -r.balance : 0

  return {
    balance: r.availableBalance,
    pendingBalance: r.pending_balance,
    totalBalance: r.totalBalance,
    lifetime_earned: parseFloat(String(wallet.lifetime_earned)) || 0,
    lifetime_spent: parseFloat(String(wallet.lifetime_spent)) || 0,
    lifetime_cashed_out: r.lifetime_cashed_out,
    spendableBucks: spendableReswellBucks(r.availableBalance),
    inWalletOwed: Math.round(owed * 100) / 100,
    walletId: wallet.id,
  }
}

export async function getSellerBalance(supabase: SupabaseClient, userId: string) {
  const { data: wallet } = await supabase
    .from("wallets")
    .select("id, balance, pending_balance, lifetime_earned, lifetime_spent, lifetime_cashed_out")
    .eq("user_id", userId)
    .maybeSingle()

  return summarizeWalletBalanceRow(wallet ?? null)
}
