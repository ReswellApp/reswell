import { getSellerBalance } from "@/lib/getSellerBalance"
import { createServiceRoleClient } from "@/lib/supabase/server"

const ZERO = "0.00"

function getServiceOrThrow(): ReturnType<typeof createServiceRoleClient> | null {
  try {
    return createServiceRoleClient()
  } catch {
    return null
  }
}

export async function getAdminUserWalletSummary(userId: string) {
  const supabase = getServiceOrThrow()
  if (!supabase) {
    return { ok: false as const, message: "Server misconfigured", status: 500 }
  }

  try {
    const summary = await getSellerBalance(supabase, userId)
    return { ok: true as const, data: summary }
  } catch (e) {
    console.error("[admin wallet] get summary", e)
    return { ok: false as const, message: "Could not load wallet", status: 500 }
  }
}

/**
 * Zeros seller wallet aggregates and clears wallet activity / PayPal payout rows for the user.
 * Destructive — for admin support / test accounts only. Does not modify orders or listings.
 */
export async function resetUserWalletEarningsToZeroService(userId: string, audit: { adminId: string }) {
  const supabase = getServiceOrThrow()
  if (!supabase) {
    return { ok: false as const, message: "Server misconfigured", status: 500 }
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle()

  if (profileErr) {
    console.error("[admin wallet reset] profile lookup", profileErr)
    return { ok: false as const, message: "Could not verify user", status: 500 }
  }
  if (!profile) {
    return { ok: false as const, message: "User not found", status: 404 }
  }

  const { error: delTxErr } = await supabase.from("wallet_transactions").delete().eq("user_id", userId)
  if (delTxErr) {
    console.error("[admin wallet reset] wallet_transactions delete", delTxErr)
    return { ok: false as const, message: "Could not clear wallet activity", status: 500 }
  }

  const { error: rpcPaypalErr } = await supabase.rpc("admin_delete_paypal_payouts_for_user", {
    p_user_id: userId,
  })
  if (rpcPaypalErr) {
    const { error: delPaypalErr } = await supabase.from("paypal_payouts").delete().eq("user_id", userId)
    if (delPaypalErr) {
      // Best-effort: migration not applied yet, table missing, or PostgREST/RLS quirks. Balances still
      // clear via `wallets` + `wallet_transactions`.
      console.warn(
        "[admin wallet reset] paypal_payouts cleanup skipped (non-fatal):",
        rpcPaypalErr.message,
        "|",
        delPaypalErr.message,
      )
    }
  }

  const now = new Date().toISOString()
  const zeroPayload = {
    balance: ZERO,
    pending_balance: ZERO,
    lifetime_earned: ZERO,
    lifetime_spent: ZERO,
    lifetime_cashed_out: ZERO,
    updated_at: now,
  }

  const { data: existing, error: walletLookupErr } = await supabase
    .from("wallets")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle()

  if (walletLookupErr) {
    console.error("[admin wallet reset] wallet lookup", walletLookupErr)
    return { ok: false as const, message: "Could not load wallet", status: 500 }
  }

  if (existing) {
    const { error: upErr } = await supabase.from("wallets").update(zeroPayload).eq("user_id", userId)
    if (upErr) {
      console.error("[admin wallet reset] wallet update", upErr)
      return { ok: false as const, message: "Could not reset wallet balances", status: 500 }
    }
  } else {
    const { error: insErr } = await supabase.from("wallets").insert({
      user_id: userId,
      ...zeroPayload,
    })
    if (insErr) {
      console.error("[admin wallet reset] wallet insert", insErr)
      return { ok: false as const, message: "Could not initialize wallet", status: 500 }
    }
  }

  console.info(`[admin wallet reset] target_user=${userId} admin=${audit.adminId}`)

  return { ok: true as const }
}
