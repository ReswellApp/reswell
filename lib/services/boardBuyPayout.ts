import type { SupabaseClient } from "@supabase/supabase-js"
import { getOrCreateWalletForUser } from "@/lib/db/wallets"

function isUniqueViolation(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  if (err.code === "23505") return true
  return Boolean(err.message?.toLowerCase().includes("duplicate"))
}

export async function creditBoardBuyPayout(
  serviceSupabase: SupabaseClient,
  params: { userId: string; amountUsd: number; submissionId: string; title: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const wallet = await getOrCreateWalletForUser(serviceSupabase, params.userId)
  if (!wallet) {
    return { ok: false, error: "Could not open wallet" }
  }

  const prevAvailable = parseFloat(String(wallet.balance ?? 0))
  const amount = Math.round(params.amountUsd * 100) / 100
  const newAvailable = Math.round((prevAvailable + amount) * 100) / 100
  const newLifetime =
    Math.round((parseFloat(String(wallet.lifetime_earned ?? 0)) + amount) * 100) / 100

  const { error: walletErr } = await serviceSupabase
    .from("wallets")
    .update({
      balance: newAvailable.toFixed(2),
      lifetime_earned: newLifetime.toFixed(2),
      updated_at: new Date().toISOString(),
    })
    .eq("id", wallet.id)

  if (walletErr) {
    console.error("[boardBuyPayout] wallet update", walletErr)
    return { ok: false, error: "Could not credit wallet" }
  }

  const { error: txErr } = await serviceSupabase.from("wallet_transactions").insert({
    wallet_id: wallet.id,
    user_id: params.userId,
    type: "sale",
    amount,
    balance_after: newAvailable.toFixed(2),
    description: `Reswell bought your board: ${params.title.slice(0, 80)}`,
    reference_id: params.submissionId,
    reference_type: "board_buy_payout",
  })

  if (txErr) {
    if (isUniqueViolation(txErr)) {
      return { ok: true }
    }
    console.error("[boardBuyPayout] ledger", txErr)
    return { ok: false, error: "Could not record payout" }
  }

  return { ok: true }
}
