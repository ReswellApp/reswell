import type { SupabaseClient } from "@supabase/supabase-js"

export type WalletRow = {
  id: string
  user_id: string
  balance: string | number | null
  pending_balance?: string | number | null
  lifetime_earned?: string | number | null
  lifetime_spent?: string | number | null
  lifetime_cashed_out?: string | number | null
}

export type WalletCashoutDeductionRow = {
  walletId: string
  balanceAfter: number
  lifetimeCashedOutAfter: number
}

export type WalletInternalSpendDeductionRow = {
  walletId: string
  balanceAfter: number
  lifetimeSpentAfter: number
}

function parseMoney(v: unknown): number {
  const n = typeof v === "number" ? v : parseFloat(String(v ?? ""))
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0
}

export async function getOrCreateWalletForUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<WalletRow | null> {
  const { data: existing } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  if (existing) return existing as WalletRow

  const { data: inserted, error: insertErr } = await supabase
    .from("wallets")
    .insert({ user_id: userId })
    .select("*")
    .single()

  if (insertErr || !inserted) return null
  return inserted as WalletRow
}

export async function deductWalletForCashoutAtomic(
  supabase: SupabaseClient,
  userId: string,
  amountUsd: number,
): Promise<WalletCashoutDeductionRow | null> {
  const { data, error } = await supabase.rpc("deduct_wallet_for_cashout", {
    p_user_id: userId,
    p_amount: amountUsd,
  })

  if (error) {
    throw error
  }

  if (!data || typeof data !== "object") {
    return null
  }

  const row = data as {
    wallet_id?: unknown
    balance_after?: unknown
    lifetime_cashed_out_after?: unknown
  }

  const walletId = typeof row.wallet_id === "string" ? row.wallet_id : ""
  if (!walletId) return null

  return {
    walletId,
    balanceAfter: parseMoney(row.balance_after),
    lifetimeCashedOutAfter: parseMoney(row.lifetime_cashed_out_after),
  }
}

export async function reverseWalletCashoutDeduction(
  supabase: SupabaseClient,
  userId: string,
  amountUsd: number,
): Promise<void> {
  const { error } = await supabase.rpc("refund_to_available_balance", {
    p_user_id: userId,
    p_amount: amountUsd,
  })

  if (error) {
    throw error
  }
}

export async function deductWalletForInternalSpendAtomic(
  supabase: SupabaseClient,
  userId: string,
  amountUsd: number,
): Promise<WalletInternalSpendDeductionRow | null> {
  const { data, error } = await supabase.rpc("deduct_wallet_for_internal_spend", {
    p_user_id: userId,
    p_amount: amountUsd,
  })

  if (error) {
    throw error
  }

  if (!data || typeof data !== "object") {
    return null
  }

  const row = data as {
    wallet_id?: unknown
    balance_after?: unknown
    lifetime_spent_after?: unknown
  }

  const walletId = typeof row.wallet_id === "string" ? row.wallet_id : ""
  if (!walletId) return null

  return {
    walletId,
    balanceAfter: parseMoney(row.balance_after),
    lifetimeSpentAfter: parseMoney(row.lifetime_spent_after),
  }
}

export async function refundWalletInternalSpend(
  supabase: SupabaseClient,
  userId: string,
  amountUsd: number,
): Promise<void> {
  const { error } = await supabase.rpc("refund_wallet_internal_spend", {
    p_user_id: userId,
    p_amount: amountUsd,
  })

  if (error) {
    throw error
  }
}
