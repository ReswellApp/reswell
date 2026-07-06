import { NextResponse } from "next/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { resolveServerAuth } from "@/lib/auth/get-safe-server-user"
import { getPayPalHttpClient, paypalSdk } from "@/lib/paypal"
import {
  deductWalletBeforeCashout,
  restoreWalletAfterFailedCashout,
} from "@/lib/services/walletCashout"
import { trackKlaviyoPayout } from "@/lib/klaviyo/track-payout"
import { roundMoney } from "@/lib/utils/stripe-connect-cashout"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

function getClientForPrivilegedWalletWrites(sessionClient: SupabaseClient) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()) {
    return sessionClient
  }
  try {
    return createServiceRoleClient()
  } catch (e) {
    console.error("[paypal payout] createServiceRoleClient failed; using session client", e)
    return sessionClient
  }
}

export async function GET() {
  const { supabase, user } = await resolveServerAuth()

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  const [profileResult, payoutsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select(
        "paypal_email, paypal_payer_id, paypal_display_name, paypal_connected_at",
      )
      .eq("id", user.id)
      .single(),
    supabase
      .from("paypal_payouts")
      .select("id, amount, paypal_email, status, created_at, paypal_batch_id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ])

  const prof = profileResult.data
  return NextResponse.json({
    paypalEmail: prof?.paypal_email ?? "",
    paypalPayerId: prof?.paypal_payer_id ?? "",
    paypalDisplayName: prof?.paypal_display_name ?? "",
    paypalConnectedAt: prof?.paypal_connected_at ?? null,
    history: payoutsResult.data ?? [],
  })
}

export async function POST(req: Request) {
  const { supabase, user } = await resolveServerAuth()
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  }

  try {
    const body = (await req.json()) as { amount?: unknown }
    const rawAmount = body.amount

    const amount =
      typeof rawAmount === "number" ? rawAmount : parseFloat(String(rawAmount ?? ""))

    if (!Number.isFinite(amount)) {
      return NextResponse.json({ error: "Amount is required" }, { status: 400 })
    }

    const amountUsd = roundMoney(amount)

    if (amountUsd < 10) {
      return NextResponse.json(
        { error: "Minimum payout amount is $10.00" },
        { status: 400 },
      )
    }

    const { data: profileRow } = await supabase
      .from("profiles")
      .select("paypal_email, paypal_payer_id")
      .eq("id", user.id)
      .single()

    const paypalEmail =
      typeof profileRow?.paypal_email === "string"
        ? profileRow.paypal_email.trim()
        : ""
    const paypalPayerId =
      typeof profileRow?.paypal_payer_id === "string"
        ? profileRow.paypal_payer_id.trim()
        : ""

    if (!paypalPayerId && !paypalEmail) {
      return NextResponse.json(
        { error: "No PayPal account connected. Connect PayPal first." },
        { status: 400 },
      )
    }

    const usePayerId = Boolean(paypalPayerId)
    const receiver = usePayerId ? paypalPayerId : paypalEmail
    const recipientType = usePayerId ? "PAYPAL_ID" : "EMAIL"

    const deduction = await deductWalletBeforeCashout(supabase, user.id, amountUsd)
    if (!deduction.ok) {
      return NextResponse.json({ error: deduction.error }, { status: deduction.status })
    }

    const { walletId, balanceAfter: newBalance } = deduction

    const senderBatchId = `reswell_${user.id}_${Date.now()}`

    const paypalClient = getPayPalHttpClient()
    const request = new paypalSdk.payouts.PayoutsPostRequest()
    request.requestBody({
      sender_batch_header: {
        sender_batch_id: senderBatchId,
        email_subject: "Your Reswell payout has arrived",
        email_message:
          "Your earnings from Reswell marketplace have been sent. " +
          "Funds typically arrive within 1-3 business days.",
      },
      items: [
        {
          recipient_type: recipientType,
          amount: {
            value: amountUsd.toFixed(2),
            currency: "USD",
          },
          receiver,
          note: `Reswell marketplace payout — $${amountUsd.toFixed(2)}`,
          sender_item_id: `${senderBatchId}_1`,
        },
      ],
    })

    let payoutBatchId: string | null = null
    try {
      const response = await paypalClient.execute(request)
      const result = response.result as {
        batch_header?: { payout_batch_id?: string; batch_status?: string }
      }
      payoutBatchId = result.batch_header?.payout_batch_id ?? null
    } catch (error: unknown) {
      await restoreWalletAfterFailedCashout(supabase, user.id, amountUsd)

      const statusCode =
        error && typeof error === "object" && "statusCode" in error
          ? Number((error as { statusCode: unknown }).statusCode)
          : undefined

      console.error("PayPal payout error:", {
        message: error instanceof Error ? error.message : String(error),
        statusCode,
      })

      let userMessage = "Payout failed. Please try again."

      if (statusCode === 422) {
        userMessage =
          "PayPal could not process this payout. Check your PayPal connection and try again."
      } else if (statusCode === 401) {
        userMessage = "PayPal authentication failed. Contact Reswell support."
      } else if (statusCode === 403) {
        userMessage =
          "PayPal Payouts not enabled on this account. Contact Reswell support."
      }

      return NextResponse.json({ error: userMessage }, { status: 500 })
    }

    const payoutEmailForRow = paypalEmail || paypalPayerId || "PayPal"

    const { data: payoutRow, error: payoutInsertErr } = await supabase
      .from("paypal_payouts")
      .insert({
        user_id: user.id,
        amount: amountUsd,
        paypal_email: payoutEmailForRow,
        paypal_batch_id: payoutBatchId,
        status: "PROCESSING",
      })
      .select("id")
      .single()

    if (payoutInsertErr || !payoutRow) {
      console.error("[paypal payout] paypal_payouts insert:", payoutInsertErr)
    }

    const writeDb = getClientForPrivilegedWalletWrites(supabase)

    if (payoutRow) {
      await writeDb.from("wallet_transactions").insert({
        wallet_id: walletId,
        user_id: user.id,
        type: "cashout",
        amount: -amountUsd,
        balance_after: newBalance,
        description: `Cash-out $${amountUsd.toFixed(2)} via PayPal (pending, fee: $0.00, payout: $${amountUsd.toFixed(2)})`,
        status: "pending",
        reference_id: payoutRow.id,
        reference_type: "paypal_payout",
      })
    }

    void trackKlaviyoPayout({
      userId: user.id,
      userEmail: user.email ?? null,
      method: "paypal",
      speed: "paypal",
      amountUsd,
      feeUsd: 0,
      netUsd: amountUsd,
      destination: payoutEmailForRow,
      stripeTransferId: null,
      payoutId: payoutBatchId,
      availableBalanceAfterUsd: newBalance,
      uniqueId: payoutRow?.id
        ? `payout-paypal-${payoutRow.id}`
        : `payout-paypal-batch-${payoutBatchId ?? senderBatchId}`,
    })

    return NextResponse.json({
      success: true,
      batchId: payoutBatchId,
      message: `$${amountUsd.toFixed(2)} is on its way to your PayPal account`,
    })
  } catch (error: unknown) {
    console.error("[paypal payout] unexpected error:", error)
    return NextResponse.json({ error: "Payout failed. Please try again." }, { status: 500 })
  }
}
