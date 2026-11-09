import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchProfileIsAdmin } from "@/lib/db/profileAdmin"
import {
  fetchReswellCreditWalletForUser,
  listReswellCreditTransactionsForUser,
  type ReswellCreditTransactionRow,
  type ReswellCreditWalletRow,
} from "@/lib/db/reswellCredit"
import { creditCentsToUsd } from "@/lib/reswell-credit-rates"

/** Admin-only pilot: UI and spend/earn surfaces are hidden unless `profiles.is_admin`. */
export async function isReswellCreditPilotUser(
  supabase: SupabaseClient,
  userId: string,
): Promise<boolean> {
  return fetchProfileIsAdmin(supabase, userId)
}

export type ReswellCreditWalletSnapshot = {
  balanceUsd: number
  balanceCents: number
  lifetimeEarnedUsd: number
  lifetimeSpentUsd: number
  walletId: string | null
}

export type ReswellCreditActivityItem = {
  id: string
  type: ReswellCreditTransactionRow["type"]
  status: ReswellCreditTransactionRow["status"]
  amountUsd: number
  balanceAfterUsd: number
  description: string
  createdAt: string
  referenceType: string | null
  referenceId: string | null
}

function snapshotFromWallet(wallet: ReswellCreditWalletRow | null): ReswellCreditWalletSnapshot {
  if (!wallet) {
    return {
      balanceUsd: 0,
      balanceCents: 0,
      lifetimeEarnedUsd: 0,
      lifetimeSpentUsd: 0,
      walletId: null,
    }
  }
  return {
    balanceUsd: creditCentsToUsd(wallet.balance_cents),
    balanceCents: wallet.balance_cents,
    lifetimeEarnedUsd: creditCentsToUsd(wallet.lifetime_earned_cents),
    lifetimeSpentUsd: creditCentsToUsd(wallet.lifetime_spent_cents),
    walletId: wallet.id,
  }
}

function activityFromTx(tx: ReswellCreditTransactionRow): ReswellCreditActivityItem {
  return {
    id: tx.id,
    type: tx.type,
    status: tx.status,
    amountUsd: creditCentsToUsd(tx.amount_cents),
    balanceAfterUsd: creditCentsToUsd(tx.balance_after_cents),
    description: tx.description,
    createdAt: tx.created_at,
    referenceType: tx.reference_type,
    referenceId: tx.reference_id,
  }
}

/** Null when the user is outside the admin pilot. */
export async function getAdminReswellCreditPilotBundle(
  supabase: SupabaseClient,
  userId: string,
): Promise<{
  wallet: ReswellCreditWalletSnapshot
  activity: ReswellCreditActivityItem[]
} | null> {
  const allowed = await isReswellCreditPilotUser(supabase, userId)
  if (!allowed) return null

  const [wallet, txs] = await Promise.all([
    fetchReswellCreditWalletForUser(supabase, userId),
    listReswellCreditTransactionsForUser(supabase, userId, { limit: 40 }),
  ])

  return {
    wallet: snapshotFromWallet(wallet),
    activity: txs.map(activityFromTx),
  }
}

/** Null when outside pilot (hides Apply Reswell Credit on checkout). */
export async function getAdminReswellCreditCheckoutOffer(
  supabase: SupabaseClient,
  userId: string,
): Promise<{ spendableUsd: number; spendableCents: number } | null> {
  const allowed = await isReswellCreditPilotUser(supabase, userId)
  if (!allowed) return null
  try {
    const wallet = await fetchReswellCreditWalletForUser(supabase, userId)
    const cents = wallet?.balance_cents ?? 0
    return { spendableUsd: creditCentsToUsd(cents), spendableCents: cents }
  } catch (err) {
    console.error("[reswell-credit] balance", err)
    return { spendableUsd: 0, spendableCents: 0 }
  }
}
