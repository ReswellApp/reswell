import { NextRequest, NextResponse } from "next/server"
import { createServiceRoleClient } from "@/lib/supabase/server"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function extractPayoutBatchId(body: Record<string, unknown>): string | null {
  const resource = (body.resource ?? {}) as Record<string, unknown>
  const batchHeader =
    (resource.batch_header as Record<string, unknown> | undefined) ??
    ((
      resource.payout_batch_details as Record<string, unknown> | undefined
    )?.batch_header as Record<string, unknown> | undefined)

  const fromHeader =
    typeof batchHeader?.payout_batch_id === "string"
      ? batchHeader.payout_batch_id
      : null
  if (fromHeader) return fromHeader

  const payoutItem = resource.payout_item as Record<string, unknown> | undefined
  const fromItem =
    typeof payoutItem?.payout_batch_id === "string"
      ? payoutItem.payout_batch_id
      : null

  return fromItem
}

function extractFailureMessage(body: Record<string, unknown>): string | null {
  const resource = (body.resource ?? {}) as Record<string, unknown>
  const errors = resource.errors as unknown
  if (Array.isArray(errors) && errors[0] && typeof errors[0] === "object") {
    const m = (errors[0] as { message?: unknown }).message
    if (typeof m === "string") return m
  }
  return null
}

/**
 * PayPal payout webhooks — update local payout rows (and refund wallet on failure).
 * Configure in PayPal Developer Dashboard → Webhooks.
 * TODO: Verify webhook signatures in production (transmission id + cert chain).
 */
export async function POST(req: NextRequest) {
  let body: Record<string, unknown>
  try {
    body = (await req.json()) as Record<string, unknown>
  } catch {
    return NextResponse.json({ received: false }, { status: 400 })
  }

  const supabase = createServiceRoleClient()

  const eventType = typeof body.event_type === "string" ? body.event_type : ""
  const batchId = extractPayoutBatchId(body)

  if (!batchId) {
    return NextResponse.json({ received: true, skipped: "no_batch_id" })
  }

  const nowIso = new Date().toISOString()

  switch (eventType) {
    case "PAYMENT.PAYOUTSBATCH.SUCCESS": {
      const { data: updatedRows } = await supabase
        .from("paypal_payouts")
        .update({ status: "SUCCESS", updated_at: nowIso })
        .eq("paypal_batch_id", batchId)
        .select("id")

      const payoutId = updatedRows?.[0]?.id
      if (payoutId) {
        await supabase
          .from("wallet_transactions")
          .update({ status: "completed" })
          .eq("reference_type", "paypal_payout")
          .eq("reference_id", payoutId)
      }
      break
    }

    case "PAYMENT.PAYOUTSBATCH.DENIED":
    case "PAYMENT.PAYOUTS-ITEM.FAILED": {
      const { data: payout } = await supabase
        .from("paypal_payouts")
        .select("id, user_id, amount")
        .eq("paypal_batch_id", batchId)
        .maybeSingle()

      if (payout?.user_id != null && payout.amount != null) {
        await supabase.rpc("refund_to_available_balance", {
          p_user_id: payout.user_id,
          p_amount: payout.amount,
        })
      }

      if (payout?.id) {
        await supabase
          .from("wallet_transactions")
          .update({ status: "failed" })
          .eq("reference_type", "paypal_payout")
          .eq("reference_id", payout.id)
      }

      await supabase
        .from("paypal_payouts")
        .update({
          status: "FAILED",
          failure_reason: extractFailureMessage(body),
          updated_at: nowIso,
        })
        .eq("paypal_batch_id", batchId)
      break
    }

    case "PAYMENT.PAYOUTS-ITEM.UNCLAIMED":
      await supabase
        .from("paypal_payouts")
        .update({ status: "UNCLAIMED", updated_at: nowIso })
        .eq("paypal_batch_id", batchId)
      break

    default:
      break
  }

  return NextResponse.json({ received: true })
}
