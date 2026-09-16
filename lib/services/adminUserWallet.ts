import { summarizeStoredWalletBalanceRow } from "@/lib/getSellerBalance"
import { getOrCreateWalletForUser } from "@/lib/db/wallets"
import { insertSupportCaseEvent, resolveSupportCaseByAnyId } from "@/lib/db/supportCases"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  ADMIN_WALLET_CREDIT_HARD_MAX_USD,
  adminWalletCreditSchema,
} from "@/lib/validations/admin-user-wallet"

export const ADMIN_WALLET_CREDIT_EVENT_TYPE = "admin_wallet_credit"

const ADMIN_WALLET_CREDIT_REFERENCE_TYPE = "wallet_refund"

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
    const { data: wallet } = await supabase
      .from("wallets")
      .select("id, balance, pending_balance, lifetime_earned, lifetime_spent, lifetime_cashed_out")
      .eq("user_id", userId)
      .maybeSingle()
    return { ok: true as const, data: summarizeStoredWalletBalanceRow(wallet ?? null) }
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

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

export async function creditAdminUserWalletService(
  userId: string,
  raw: unknown,
  audit: { adminId: string },
): Promise<
  | { ok: true; amountUsd: number; balanceAfter: number }
  | { ok: false; message: string; status: number }
> {
  const parsed = adminWalletCreditSchema.safeParse(raw)
  if (!parsed.success) {
    const needsConfirm = parsed.error.issues.some((issue) => issue.path.includes("confirm_over_limit"))
    return {
      ok: false,
      message: needsConfirm
        ? "Confirm amounts over $250"
        : `Enter a valid amount up to $${ADMIN_WALLET_CREDIT_HARD_MAX_USD.toLocaleString("en-US")}`,
      status: 400,
    }
  }

  const supabase = getServiceOrThrow()
  if (!supabase) {
    return { ok: false, message: "Server misconfigured", status: 500 }
  }

  const { data: profile, error: profileErr } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", userId)
    .maybeSingle()

  if (profileErr) {
    console.error("[admin wallet credit] profile lookup", profileErr)
    return { ok: false, message: "Could not verify user", status: 500 }
  }
  if (!profile) {
    return { ok: false, message: "User not found", status: 404 }
  }

  const wallet = await getOrCreateWalletForUser(supabase, userId)
  if (!wallet) {
    return { ok: false, message: "Could not open wallet", status: 500 }
  }

  const amountUsd = roundMoney(parsed.data.amount_usd)
  const nowIso = new Date().toISOString()
  const newBalance = roundMoney(parseFloat(String(wallet.balance ?? 0)) + amountUsd)
  const newLifetimeEarned = roundMoney(
    parseFloat(String(wallet.lifetime_earned ?? 0)) + amountUsd,
  )
  const note = parsed.data.note?.trim()
  const desc = note
    ? `Admin wallet credit — $${amountUsd.toFixed(2)}. ${note}`
    : `Admin wallet credit — $${amountUsd.toFixed(2)}`

  const { error: txErr } = await supabase.from("wallet_transactions").insert({
    wallet_id: wallet.id,
    user_id: userId,
    type: "refund",
    amount: amountUsd,
    balance_after: newBalance.toFixed(2),
    description: desc.slice(0, 500),
    status: "completed",
    reference_id: crypto.randomUUID(),
    reference_type: ADMIN_WALLET_CREDIT_REFERENCE_TYPE,
  })

  if (txErr) {
    console.error("[admin wallet credit] transaction", txErr)
    return { ok: false, message: "Could not record wallet credit", status: 500 }
  }

  const { error: updErr } = await supabase
    .from("wallets")
    .update({
      balance: newBalance.toFixed(2),
      lifetime_earned: newLifetimeEarned.toFixed(2),
      updated_at: nowIso,
    })
    .eq("id", wallet.id)

  if (updErr) {
    console.error("[admin wallet credit] wallet update", updErr)
    return { ok: false, message: "Could not update wallet balance", status: 500 }
  }

  if (parsed.data.support_case_id) {
    const supportCase = await resolveSupportCaseByAnyId(supabase, parsed.data.support_case_id)
    if (supportCase) {
      await insertSupportCaseEvent(supabase, {
        case_id: supportCase.id,
        actor_admin_id: audit.adminId,
        event_type: ADMIN_WALLET_CREDIT_EVENT_TYPE,
        payload: {
          amount_usd: amountUsd,
          note: note ?? null,
          balance_after: newBalance,
          user_id: userId,
        },
      })
    } else {
      console.warn(
        `[admin wallet credit] support case not found case=${parsed.data.support_case_id} user=${userId}`,
      )
    }
  }

  console.info(
    `[admin wallet credit] target_user=${userId} admin=${audit.adminId} amount=${amountUsd.toFixed(2)}`,
  )

  return { ok: true, amountUsd, balanceAfter: newBalance }
}
