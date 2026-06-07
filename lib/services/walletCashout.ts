import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  deductWalletForCashoutAtomic,
  getOrCreateWalletForUser,
  reverseWalletCashoutDeduction,
  type WalletCashoutDeductionRow,
} from "@/lib/db/wallets"
import { reconcileWalletAggregates, walletAggregateStrings } from "@/lib/wallet-reconcile"
import { roundMoney } from "@/lib/utils/stripe-connect-cashout"

export type WalletCashoutDeductionResult =
  | ({ ok: true } & WalletCashoutDeductionRow)
  | { ok: false; error: string; status: number }

function getClientForPrivilegedWalletWrites(sessionClient: SupabaseClient): SupabaseClient {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return sessionClient
  }
  try {
    return createServiceRoleClient()
  } catch (e) {
    console.error("[wallet cashout] createServiceRoleClient failed; using session client", e)
    return sessionClient
  }
}

export async function deductWalletBeforeCashout(
  supabase: SupabaseClient,
  userId: string,
  amountUsdRaw: number,
): Promise<WalletCashoutDeductionResult> {
  const amountUsd = roundMoney(amountUsdRaw)

  let wallet = await getOrCreateWalletForUser(supabase, userId)
  if (!wallet) {
    return { ok: false, error: "Could not load wallet", status: 500 }
  }

  const agg = reconcileWalletAggregates(wallet)
  if (agg.needsPersist) {
    const s = walletAggregateStrings(agg)
    const writeDb = getClientForPrivilegedWalletWrites(supabase)
    await writeDb
      .from("wallets")
      .update({
        balance: s.balance,
        pending_balance: s.pending_balance,
        lifetime_cashed_out: s.lifetime_cashed_out,
        updated_at: new Date().toISOString(),
      })
      .eq("id", wallet.id)
      .eq("user_id", userId)
    wallet = {
      ...wallet,
      balance: s.balance,
      pending_balance: s.pending_balance,
      lifetime_cashed_out: s.lifetime_cashed_out,
    }
  }

  const spendable = roundMoney(agg.availableBalance)
  const rawBalance = roundMoney(parseFloat(String(wallet.balance)))

  if (amountUsd > spendable) {
    return {
      ok: false,
      error:
        spendable < 0.01 && rawBalance < 0
          ? "Your in-wallet Reswell balance is below zero (for example after a refund to the buyer). " +
            "You cannot cash out until new in-app sales bring it back to zero or above."
          : `Insufficient balance. Available: $${spendable.toFixed(2)}`,
      status: 400,
    }
  }

  const writeDb = getClientForPrivilegedWalletWrites(supabase)
  let deducted: WalletCashoutDeductionRow | null
  try {
    deducted = await deductWalletForCashoutAtomic(writeDb, userId, amountUsd)
  } catch (e) {
    console.error("[wallet cashout] deduct_wallet_for_cashout rpc failed", e)
    return { ok: false, error: "Could not reserve wallet balance for cash-out", status: 500 }
  }

  if (!deducted) {
    return {
      ok: false,
      error: `Insufficient balance. Available: $${spendable.toFixed(2)}`,
      status: 400,
    }
  }

  return { ok: true, ...deducted }
}

export async function restoreWalletAfterFailedCashout(
  supabase: SupabaseClient,
  userId: string,
  amountUsd: number,
): Promise<void> {
  const writeDb = getClientForPrivilegedWalletWrites(supabase)
  try {
    await reverseWalletCashoutDeduction(writeDb, userId, amountUsd)
  } catch (e) {
    console.error("[wallet cashout] refund_to_available_balance after failed payout", e)
  }
}
