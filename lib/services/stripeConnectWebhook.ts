import type Stripe from "stripe"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getStripeConnectTransferByStripeId } from "@/lib/db/stripeConnect"
import { syncStripeConnectAccountRow } from "@/lib/services/stripeConnect"
import { roundMoney } from "@/lib/utils/stripe-connect-cashout"

/**
 * Returns true when the event was a Connect lifecycle event we handled (so the webhook can ACK).
 */
export async function tryHandleStripeConnectEvent(event: Stripe.Event): Promise<boolean> {
  if (event.type === "account.updated") {
    const account = event.data.object as Stripe.Account
    if (account.id?.startsWith("acct_")) {
      const supabase = createServiceRoleClient()
      const { data: row } = await supabase
        .from("stripe_connect_accounts")
        .select("stripe_account_id")
        .eq("stripe_account_id", account.id)
        .maybeSingle()
      if (row) {
        try {
          await syncStripeConnectAccountRow(supabase, account.id)
        } catch (e) {
          console.error("[stripe webhook] account.updated sync failed", e)
        }
        return true
      }
    }
    return false
  }

  if (event.type === "transfer.reversed") {
    const reversal = event.data.object as unknown as {
      amount?: number
      transfer?: string | { id?: string }
    }
    const transferRef = reversal.transfer
    const transferId =
      typeof transferRef === "string"
        ? transferRef
        : transferRef && typeof transferRef === "object" && typeof transferRef.id === "string"
          ? transferRef.id
          : null

    if (!transferId) {
      console.warn("[stripe webhook] transfer.reversed missing transfer id")
      return true
    }

    const supabase = createServiceRoleClient()
    const row = await getStripeConnectTransferByStripeId(supabase, transferId)
    if (!row) {
      return true
    }

    // Refund the full wallet debit recorded for this cash-out (includes instant fee that never left the platform).
    const refundUsd = roundMoney(parseFloat(String(row.amount)))
    const nowIso = new Date().toISOString()

    const { error: rpcErr } = await supabase.rpc("refund_to_available_balance", {
      p_user_id: row.user_id,
      p_amount: refundUsd,
    })
    if (rpcErr) {
      console.error("[stripe webhook] transfer.reversed refund rpc", rpcErr)
    }

    await supabase
      .from("stripe_connect_transfers")
      .update({
        status: "REVERSED",
        failure_reason: "Transfer reversed by Stripe",
        updated_at: nowIso,
      })
      .eq("id", row.id)

    await supabase
      .from("wallet_transactions")
      .update({ status: "failed" })
      .eq("reference_type", "stripe_connect_transfer")
      .eq("reference_id", row.id)

    return true
  }

  return false
}
