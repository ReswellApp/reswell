import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { getStripe } from "@/lib/stripe-server"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  completeSurfboardCheckoutFromSession,
  isPeerListingCheckoutMode,
} from "@/lib/checkout/surfboard-stripe-completion"
import { completeCartCheckoutFromSession } from "@/lib/checkout/cart-stripe-completion"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

export async function POST(request: NextRequest) {
  const stripe = getStripe()
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET?.trim()

  if (!stripe || !webhookSecret) {
    console.error("[stripe webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_SECRET")
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 })
  }

  const body = await request.text()
  const sig = request.headers.get("stripe-signature")
  if (!sig) {
    return NextResponse.json({ error: "Missing stripe-signature" }, { status: 400 })
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error("[stripe webhook] Signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch (e) {
    console.error("[stripe webhook] SUPABASE_SERVICE_ROLE_KEY missing:", e)
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  try {
    switch (event.type) {
      // ── Existing checkout events ───────────────────────────────────────────
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session
        const mode = session.metadata?.mode
        if (isPeerListingCheckoutMode(mode)) {
          const result = await completeSurfboardCheckoutFromSession(supabase, session, {})
          if (!result.ok) {
            console.error("[stripe webhook] Peer listing fulfillment failed:", result.error, session.id)
          }
        } else if (mode === "cart") {
          const result = await completeCartCheckoutFromSession(supabase, session)
          if (!result.ok) {
            console.error("[stripe webhook] Cart fulfillment failed:", result.error, session.id)
          }
        }
        break
      }

      // ── Connect: payout events ─────────────────────────────────────────────
      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout
        const stripeAccountId = (event as unknown as { account?: string }).account

        if (stripeAccountId) {
          // Update payout status in DB
          const { data: payoutRecord } = await supabase
            .from("payouts")
            .select("id, user_id")
            .eq("stripe_payout_id", payout.id)
            .single()

          if (payoutRecord) {
            await supabase
              .from("payouts")
              .update({
                status: "PAID",
                updated_at: new Date().toISOString(),
              })
              .eq("id", payoutRecord.id)

            console.log(`[stripe webhook] Payout ${payout.id} marked PAID for user ${payoutRecord.user_id}`)
          }
        }
        break
      }

      case "payout.failed": {
        const payout = event.data.object as Stripe.Payout
        const stripeAccountId = (event as unknown as { account?: string }).account

        if (stripeAccountId) {
          const { data: payoutRecord } = await supabase
            .from("payouts")
            .select("id, user_id, amount")
            .eq("stripe_payout_id", payout.id)
            .single()

          if (payoutRecord) {
            const failureReason = payout.failure_message ?? payout.failure_code ?? "Unknown error"

            await supabase
              .from("payouts")
              .update({
                status: "FAILED",
                failure_reason: failureReason,
                updated_at: new Date().toISOString(),
              })
              .eq("id", payoutRecord.id)

            // Return amount to available_balance
            const { data: balance } = await supabase
              .from("seller_balances")
              .select("available_balance, lifetime_paid_out")
              .eq("user_id", payoutRecord.user_id)
              .single()

            if (balance) {
              await supabase
                .from("seller_balances")
                .update({
                  available_balance: parseFloat(balance.available_balance) + parseFloat(payoutRecord.amount),
                  lifetime_paid_out: Math.max(0, parseFloat(balance.lifetime_paid_out) - parseFloat(payoutRecord.amount)),
                  updated_at: new Date().toISOString(),
                })
                .eq("user_id", payoutRecord.user_id)
            }

            console.log(`[stripe webhook] Payout ${payout.id} FAILED for user ${payoutRecord.user_id}: ${failureReason}`)
          }
        }
        break
      }

      case "payout.canceled": {
        const payout = event.data.object as Stripe.Payout

        const { data: payoutRecord } = await supabase
          .from("payouts")
          .select("id, user_id, amount")
          .eq("stripe_payout_id", payout.id)
          .single()

        if (payoutRecord) {
          await supabase
            .from("payouts")
            .update({
              status: "CANCELED",
              updated_at: new Date().toISOString(),
            })
            .eq("id", payoutRecord.id)

          // Return amount to available_balance
          const { data: balance } = await supabase
            .from("seller_balances")
            .select("available_balance")
            .eq("user_id", payoutRecord.user_id)
            .single()

          if (balance) {
            await supabase
              .from("seller_balances")
              .update({
                available_balance: parseFloat(balance.available_balance) + parseFloat(payoutRecord.amount),
                updated_at: new Date().toISOString(),
              })
              .eq("user_id", payoutRecord.user_id)
          }
        }
        break
      }

      // ── Connect: account status updates ────────────────────────────────────
      case "account.updated": {
        const account = event.data.object as Stripe.Account

        const status = account.payouts_enabled
          ? "ACTIVE"
          : account.details_submitted
          ? "RESTRICTED"
          : "PENDING"

        await supabase
          .from("seller_stripe_accounts")
          .update({
            account_status: status,
            payouts_enabled: account.payouts_enabled,
            charges_enabled: account.charges_enabled,
            details_submitted: account.details_submitted,
            updated_at: new Date().toISOString(),
          })
          .eq("stripe_account_id", account.id)

        console.log(`[stripe webhook] account.updated ${account.id} → ${status}`)
        break
      }

      // ── Connect: transfer log ──────────────────────────────────────────────
      case "transfer.created": {
        const transfer = event.data.object as Stripe.Transfer
        console.log(`[stripe webhook] transfer.created ${transfer.id} amount=${transfer.amount}`)
        break
      }

      default:
        // Unhandled event types — just acknowledge
        break
    }
  } catch (e) {
    console.error("[stripe webhook] Handler error:", e)
    return NextResponse.json({ error: "Handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
