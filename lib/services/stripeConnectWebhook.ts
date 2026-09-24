import type Stripe from "stripe"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { getStripeConnectTransferByStripeId, getStripeConnectTransferByPayoutId } from "@/lib/db/stripeConnect"
import {
  restoreWalletForReversedConnectCashout,
  syncStripeConnectAccountRow,
} from "@/lib/services/stripeConnect"
import {
  buildPayoutRequirementNotice,
  requirementSnapshotFromAccount,
} from "@/lib/utils/stripe-connect-status"
import { getStripe } from "@/lib/stripe-server"
import { roundMoney } from "@/lib/utils/stripe-connect-cashout"

type ConnectTransferReversalContext = {
  transferRowId: string
  userId: string
  amountUsd: number
}

async function resolveConnectTransferReversalContext(
  stripeTransferId: string,
): Promise<ConnectTransferReversalContext | null> {
  const supabase = createServiceRoleClient()
  const row = await getStripeConnectTransferByStripeId(supabase, stripeTransferId)
  if (row) {
    return {
      transferRowId: row.id,
      userId: row.user_id,
      amountUsd: roundMoney(parseFloat(String(row.amount))),
    }
  }

  try {
    const stripe = getStripe()
    const transfer = await stripe.transfers.retrieve(stripeTransferId)
    const userId =
      typeof transfer.metadata?.reswell_user_id === "string"
        ? transfer.metadata.reswell_user_id.trim()
        : ""
    const transferRowId =
      typeof transfer.metadata?.reswell_connect_transfer_id === "string"
        ? transfer.metadata.reswell_connect_transfer_id.trim()
        : ""
    const grossRaw = transfer.metadata?.reswell_gross_amount_usd
    const grossParsed =
      typeof grossRaw === "string" ? roundMoney(parseFloat(grossRaw)) : Number.NaN
    const amountUsd = Number.isFinite(grossParsed)
      ? grossParsed
      : roundMoney((transfer.amount ?? 0) / 100)

    if (!userId || !transferRowId || amountUsd <= 0) {
      console.warn("[stripe webhook] transfer.reversed missing reswell metadata", {
        stripeTransferId,
        userId: userId || null,
        transferRowId: transferRowId || null,
        amountUsd,
      })
      return null
    }

    return { transferRowId, userId, amountUsd }
  } catch (e) {
    console.error("[stripe webhook] transfer.reversed retrieve transfer", e)
    return null
  }
}

/**
 * In-app notice when Stripe adds (or changes) fields the seller must submit.
 * Same fingerprint is not sent again. Cleared once Stripe lists nothing due.
 */
async function notifySellerOfConnectRequirements(
  supabase: ReturnType<typeof createServiceRoleClient>,
  input: {
    userId: string
    stripeAccountId: string
    notice: { fingerprint: string; message: string } | null
  },
): Promise<void> {
  const { data: stored, error: readError } = await supabase
    .from("stripe_connect_accounts")
    .select("requirements_notice_fingerprint")
    .eq("stripe_account_id", input.stripeAccountId)
    .maybeSingle()

  if (readError) {
    console.error("[stripe webhook] requirements notice read failed", readError)
    return
  }

  const previous =
    typeof stored?.requirements_notice_fingerprint === "string"
      ? stored.requirements_notice_fingerprint
      : null
  const next = input.notice?.fingerprint ?? null
  if (previous === next) return

  if (next && input.notice) {
    const { error: insertError } = await supabase.from("notifications").insert({
      user_id: input.userId,
      type: "payout_info_required",
      message: input.notice.message,
    })
    if (insertError) {
      console.error("[stripe webhook] payout requirement notification failed", insertError)
      return
    }
  }

  const { error: updateError } = await supabase
    .from("stripe_connect_accounts")
    .update({
      requirements_notice_fingerprint: next,
      updated_at: new Date().toISOString(),
    })
    .eq("stripe_account_id", input.stripeAccountId)

  if (updateError) {
    console.error("[stripe webhook] requirements notice fingerprint update failed", updateError)
  }
}

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
        .select("user_id, stripe_account_id")
        .eq("stripe_account_id", account.id)
        .maybeSingle()
      if (row) {
        try {
          const synced = await syncStripeConnectAccountRow(supabase, account.id)
          const userId = typeof row.user_id === "string" ? row.user_id : ""
          if (userId) {
            await notifySellerOfConnectRequirements(supabase, {
              userId,
              stripeAccountId: account.id,
              notice: buildPayoutRequirementNotice(requirementSnapshotFromAccount(synced)),
            })
          }
        } catch (e) {
          console.error("[stripe webhook] account.updated sync failed", e)
        }
        return true
      }
    }
    return false
  }

  if (event.type === "payout.failed" || event.type === "payout.canceled") {
    const payout = event.data.object as Stripe.Payout
    const supabase = createServiceRoleClient()
    const row = await getStripeConnectTransferByPayoutId(supabase, payout.id)
    if (!row || row.status === "REVERSED") {
      return true
    }

    const amountUsd = roundMoney(parseFloat(String(row.amount)))
    const failureReason =
      typeof payout.failure_message === "string" && payout.failure_message.trim()
        ? payout.failure_message.trim()
        : event.type === "payout.canceled"
          ? "Instant payout canceled"
          : "Instant payout failed"

    if (row.stripe_transfer_id) {
      try {
        const stripe = getStripe()
        await stripe.transfers.createReversal(row.stripe_transfer_id)
      } catch (e) {
        console.error("[stripe webhook] createReversal after payout failure", e)
      }
    }

    const restored = await restoreWalletForReversedConnectCashout(supabase, {
      transferRowId: row.id,
      userId: row.user_id,
      amountUsd,
      failureReason,
      fromStatuses: ["PROCESSING", "SUCCEEDED"],
    })

    if (!restored) {
      console.error("[stripe webhook] CRITICAL wallet not restored on payout failure", {
        payoutId: payout.id,
        transferRowId: row.id,
        userId: row.user_id,
        amountUsd,
      })
    }

    await supabase
      .from("wallet_transactions")
      .update({ status: "failed" })
      .eq("reference_type", "stripe_connect_transfer")
      .eq("reference_id", row.id)

    return true
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

    const ctx = await resolveConnectTransferReversalContext(transferId)
    if (!ctx) {
      return true
    }

    const supabase = createServiceRoleClient()
    const restored = await restoreWalletForReversedConnectCashout(supabase, {
      transferRowId: ctx.transferRowId,
      userId: ctx.userId,
      amountUsd: ctx.amountUsd,
      failureReason: "Transfer reversed by Stripe",
    })

    if (!restored) {
      console.error("[stripe webhook] CRITICAL wallet not restored on transfer.reversed", {
        transferId,
        ...ctx,
      })
    }

    await supabase
      .from("wallet_transactions")
      .update({ status: "failed" })
      .eq("reference_type", "stripe_connect_transfer")
      .eq("reference_id", ctx.transferRowId)

    return true
  }

  return false
}
