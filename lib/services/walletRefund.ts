import type { SupabaseClient } from "@supabase/supabase-js"
import { relistAfterRefund } from "@/lib/services/listingRelist"

function roundMoney(n: number): number {
  return Math.round(n * 100) / 100
}

type WalletOrderRow = {
  id: string
  listing_id: string
  buyer_id: string
  seller_id: string
  amount: number | string
  seller_earnings: number | string | null
  status: string
}

type RefundResult =
  | { ok: true }
  | { ok: false; error: string; status: number }

/**
 * Full refund for a Reswell Bucks (wallet-paid) order.
 *
 * 1. Mark order as `refunded`, set `refunded_at`
 * 2. Cancel all payouts for the order
 * 3. Claw back seller earnings (pending or available)
 * 4. Credit buyer wallet with the full order amount
 * 5. Re-list the listing (sold → active)
 */
export async function applyWalletOrderRefund(
  supabase: SupabaseClient,
  order: WalletOrderRow,
): Promise<RefundResult> {
  const nowIso = new Date().toISOString()
  const orderAmount = roundMoney(Number(order.amount))
  const sellerEarnings = roundMoney(Number(order.seller_earnings ?? 0))

  if (order.status === "refunded") {
    return { ok: false, error: "Order is already refunded", status: 409 }
  }

  // Snapshot before mutating payouts: cancel sets status to `cancelled`, which must not be confused
  // with `pending` (seller earnings already moved to spendable balance after fulfillment).
  const { data: payoutBefore } = await supabase
    .from("payouts")
    .select("status")
    .eq("order_id", order.id)
    .maybeSingle()

  const earningsReleasedToAvailable = payoutBefore?.status === "pending"

  // --- 1. Mark order refunded ---
  const { error: orderErr } = await supabase
    .from("orders")
    .update({ status: "refunded", refunded_at: nowIso, updated_at: nowIso })
    .eq("id", order.id)
    .neq("status", "refunded")

  if (orderErr) {
    console.error("[wallet refund] order status update", orderErr)
    return { ok: false, error: "Could not update order status", status: 500 }
  }

  // --- 2. Cancel payouts ---
  const { error: payoutErr } = await supabase
    .from("payouts")
    .update({ status: "cancelled", updated_at: nowIso })
    .eq("order_id", order.id)

  if (payoutErr) {
    console.error("[wallet refund] payouts cancel", payoutErr)
  }

  // --- 3. Claw back seller earnings ---
  if (sellerEarnings > 0) {
    await clawbackSellerEarnings(
      supabase,
      order,
      sellerEarnings,
      nowIso,
      earningsReleasedToAvailable,
    )
  }

  // --- 4. Credit buyer ---
  if (orderAmount > 0) {
    await creditBuyerWallet(supabase, order, orderAmount, nowIso)
  }

  // --- 5. Re-list ---
  await relistAfterRefund(supabase, order.listing_id)

  return { ok: true }
}

async function clawbackSellerEarnings(
  supabase: SupabaseClient,
  order: WalletOrderRow,
  clawbackUsd: number,
  nowIso: string,
  earningsReleasedToAvailable: boolean,
): Promise<void> {
  let { data: wallet } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", order.seller_id)
    .maybeSingle()

  if (!wallet) {
    console.error("[wallet refund] seller wallet not found", { seller: order.seller_id })
    return
  }

  const prevBalance = parseFloat(String(wallet.balance ?? 0))
  const prevPending = parseFloat(
    String((wallet as { pending_balance?: string | number | null }).pending_balance ?? 0),
  )
  const prevEarned = parseFloat(String(wallet.lifetime_earned ?? 0))

  const { data: listing } = await supabase
    .from("listings")
    .select("title")
    .eq("id", order.listing_id)
    .maybeSingle()

  const title = typeof listing?.title === "string" ? listing.title : "Listing"
  const desc = `Refund — "${title}" (full refund $${clawbackUsd.toFixed(2)}, Reswell Bucks; order ${order.id.slice(0, 8)})`

  if (earningsReleasedToAvailable) {
    const newBalance = roundMoney(Math.max(0, prevBalance - clawbackUsd))
    const newEarned = roundMoney(Math.max(0, prevEarned - clawbackUsd))

    const { error: txErr } = await supabase.from("wallet_transactions").insert({
      wallet_id: wallet.id,
      user_id: order.seller_id,
      type: "refund",
      amount: -clawbackUsd,
      balance_after: newBalance.toFixed(2),
      description: desc,
      status: "completed",
      reference_id: order.id,
      reference_type: "wallet_refund",
    })

    if (txErr) {
      console.error("[wallet refund] seller tx insert", txErr)
      return
    }

    const { error: walletErr } = await supabase
      .from("wallets")
      .update({
        balance: newBalance.toFixed(2),
        lifetime_earned: newEarned.toFixed(2),
        updated_at: nowIso,
      })
      .eq("id", wallet.id)

    if (walletErr) {
      console.error("[wallet refund] seller wallet update", walletErr)
    }
  } else {
    const clawFromPending = roundMoney(Math.min(clawbackUsd, Math.max(0, prevPending)))
    const newPending = roundMoney(Math.max(0, prevPending - clawFromPending))
    const newEarned = roundMoney(Math.max(0, prevEarned - clawFromPending))

    const { error: txErr } = await supabase.from("wallet_transactions").insert({
      wallet_id: wallet.id,
      user_id: order.seller_id,
      type: "refund",
      amount: -clawFromPending,
      balance_after: roundMoney(prevBalance).toFixed(2),
      description: `${desc} (pending earnings)`,
      status: "completed",
      reference_id: order.id,
      reference_type: "wallet_refund",
    })

    if (txErr) {
      console.error("[wallet refund] seller pending tx insert", txErr)
      return
    }

    const { error: walletErr } = await supabase
      .from("wallets")
      .update({
        pending_balance: newPending.toFixed(2),
        lifetime_earned: newEarned.toFixed(2),
        updated_at: nowIso,
      })
      .eq("id", wallet.id)

    if (walletErr) {
      console.error("[wallet refund] seller wallet pending update", walletErr)
    }
  }
}

async function creditBuyerWallet(
  supabase: SupabaseClient,
  order: WalletOrderRow,
  creditUsd: number,
  nowIso: string,
): Promise<void> {
  let { data: wallet } = await supabase
    .from("wallets")
    .select("*")
    .eq("user_id", order.buyer_id)
    .maybeSingle()

  if (!wallet) {
    const { data: newWallet, error: insertErr } = await supabase
      .from("wallets")
      .insert({ user_id: order.buyer_id })
      .select()
      .single()
    if (insertErr || !newWallet) {
      console.error("[wallet refund] buyer wallet create failed", { buyer: order.buyer_id })
      return
    }
    wallet = newWallet
  }

  const prevBalance = parseFloat(String(wallet.balance ?? 0))
  const prevSpent = parseFloat(String(wallet.lifetime_spent ?? 0))
  const newBalance = roundMoney(prevBalance + creditUsd)
  const newSpent = roundMoney(Math.max(0, prevSpent - creditUsd))

  const { data: listing } = await supabase
    .from("listings")
    .select("title")
    .eq("id", order.listing_id)
    .maybeSingle()

  const title = typeof listing?.title === "string" ? listing.title : "Listing"

  const { error: txErr } = await supabase.from("wallet_transactions").insert({
    wallet_id: wallet.id,
    user_id: order.buyer_id,
    type: "refund",
    amount: creditUsd,
    balance_after: newBalance.toFixed(2),
    description: `Refund — "${title}" ($${creditUsd.toFixed(2)} returned to your balance)`,
    status: "completed",
    reference_id: order.id,
    reference_type: "wallet_refund",
  })

  if (txErr) {
    console.error("[wallet refund] buyer tx insert", txErr)
    return
  }

  const { error: walletErr } = await supabase
    .from("wallets")
    .update({
      balance: newBalance.toFixed(2),
      lifetime_spent: newSpent.toFixed(2),
      updated_at: nowIso,
    })
    .eq("id", wallet.id)

  if (walletErr) {
    console.error("[wallet refund] buyer wallet update", walletErr)
  }
}
