import type { SupabaseClient } from "@supabase/supabase-js"

function isUniqueViolation(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false
  if (err.code === "23505") return true
  return Boolean(err.message?.toLowerCase().includes("duplicate"))
}

/**
 * Credits one party's pending earnings for an order: ensures a wallet exists, moves the amount into
 * `pending_balance`, bumps `lifetime_earned`, and writes a single ledger row. Shared by the online
 * checkout path and the in-store POS path so settlement stays identical across sales channels.
 * Idempotent against concurrent racers via the unique ledger (reference_type, reference_id).
 */
export async function creditOrderPendingEarnings(
  serviceSupabase: SupabaseClient,
  params: {
    userId: string
    amountUsd: number
    orderId: string
    description: string
    referenceType: string
  },
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { userId, amountUsd, orderId, description, referenceType } = params

  let { data: wallet } = await serviceSupabase
    .from("wallets")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()

  if (!wallet) {
    const { data: newWallet, error: walletInsertErr } = await serviceSupabase
      .from("wallets")
      .insert({ user_id: userId })
      .select()
      .single()
    if (walletInsertErr) {
      console.error("[orderPendingEarnings] wallet insert:", walletInsertErr)
    }
    wallet = newWallet
  }

  if (!wallet) {
    return { ok: false, error: "Wallet error", status: 500 }
  }

  const wRow = wallet as typeof wallet & { pending_balance?: string | number | null }
  const prevAvailable = parseFloat(String(wallet.balance ?? 0))
  const prevPending = parseFloat(String(wRow.pending_balance ?? 0))
  const newPending = Math.round((prevPending + amountUsd) * 100) / 100
  const newLifetimeEarned =
    Math.round((parseFloat(String(wallet.lifetime_earned ?? 0)) + amountUsd) * 100) / 100

  const { error: walletUpdateErr } = await serviceSupabase
    .from("wallets")
    .update({
      pending_balance: newPending.toFixed(2),
      lifetime_earned: newLifetimeEarned.toFixed(2),
      updated_at: new Date().toISOString(),
    })
    .eq("id", wallet.id)

  if (walletUpdateErr) {
    console.error("[orderPendingEarnings] wallet pending update:", walletUpdateErr)
    return { ok: false, error: "Could not record pending earnings", status: 500 }
  }

  const { error: pendingTxErr } = await serviceSupabase.from("wallet_transactions").insert({
    wallet_id: wallet.id,
    user_id: userId,
    type: "sale",
    amount: amountUsd,
    balance_after: prevAvailable.toFixed(2),
    description,
    reference_id: String(orderId),
    reference_type: referenceType,
  })

  if (pendingTxErr) {
    if (isUniqueViolation(pendingTxErr)) {
      const { data: racedLedger } = await serviceSupabase
        .from("wallet_transactions")
        .select("id")
        .eq("reference_type", referenceType)
        .eq("reference_id", String(orderId))
        .maybeSingle()
      if (racedLedger?.id) {
        return { ok: true }
      }
      console.error("[orderPendingEarnings] pending wallet_transactions duplicate without row:", pendingTxErr)
      return { ok: false, error: "Could not record pending sale", status: 500 }
    }
    console.error("[orderPendingEarnings] pending wallet_transactions:", pendingTxErr)
    return { ok: false, error: "Could not record pending sale", status: 500 }
  }

  return { ok: true }
}
