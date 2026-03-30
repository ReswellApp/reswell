import { NextRequest, NextResponse } from "next/server"
import Stripe from "stripe"
import { getStripeOptional } from "@/lib/stripe-client"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  completeSurfboardCheckoutFromSession,
  isPeerListingCheckoutMode,
} from "@/lib/checkout/surfboard-stripe-completion"
import { completeCartCheckoutFromSession } from "@/lib/checkout/cart-stripe-completion"
import { persistSellerAccountFromV2Account } from "@/lib/stripe-connect-v2-sync"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

async function handleV2CoreWebhookEvent(
  stripe: Stripe,
  supabase: ReturnType<typeof createServiceRoleClient>,
  event: Stripe.V2.Core.Event
) {
  const type = event.type as string
  if (
    type === "v2.core.account[requirements].updated" ||
    type === "v2.core.account[configuration.recipient].capability_status_updated"
  ) {
    const related = "related_object" in event ? event.related_object : null
    const accountId =
      related && typeof related === "object" && related !== null && "id" in related
        ? (related as { id: string }).id
        : null

    if (accountId) {
      const account = await stripe.v2.core.accounts.retrieve(accountId, {
        include: ["configuration.recipient", "requirements"],
      })
      await persistSellerAccountFromV2Account(supabase, account)
    }
  }
}

export async function POST(request: NextRequest) {
  const stripe = getStripeOptional()
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

  let supabase: ReturnType<typeof createServiceRoleClient>
  try {
    supabase = createServiceRoleClient()
  } catch (e) {
    console.error("[stripe webhook] SUPABASE_SERVICE_ROLE_KEY missing:", e)
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 })
  }

  try {
    const notification = stripe.parseEventNotification(body, sig, webhookSecret)
    const v2Event = await notification.fetchEvent()
    if (typeof v2Event.type === "string" && v2Event.type.startsWith("v2.")) {
      try {
        await handleV2CoreWebhookEvent(stripe, supabase, v2Event)
      } catch (e) {
        console.error("[stripe webhook] V2 handler failed:", e)
        return NextResponse.json({ error: "Handler failed" }, { status: 500 })
      }
      return NextResponse.json({ received: true })
    }
  } catch (v2Err) {
    if (!(v2Err instanceof Stripe.errors.StripeSignatureVerificationError)) {
      console.warn("[stripe webhook] V2 notification not used for this payload; trying V1:", v2Err)
    }
  }

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret)
  } catch (err) {
    console.error("[stripe webhook] V1 signature verification failed:", err)
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 })
  }

  try {
    switch (event.type) {
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

      case "payout.paid": {
        const payout = event.data.object as Stripe.Payout
        const stripeAccountId = (event as unknown as { account?: string }).account

        if (stripeAccountId) {
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
            const failureReason =
              payout.failure_message ?? payout.failure_code ?? "Unknown error"

            await supabase
              .from("payouts")
              .update({
                status: "FAILED",
                failure_reason: failureReason,
                updated_at: new Date().toISOString(),
              })
              .eq("id", payoutRecord.id)

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
                  lifetime_paid_out: Math.max(
                    0,
                    parseFloat(balance.lifetime_paid_out) - parseFloat(payoutRecord.amount)
                  ),
                  updated_at: new Date().toISOString(),
                })
                .eq("user_id", payoutRecord.user_id)
            }
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

      case "transfer.created": {
        const transfer = event.data.object as Stripe.Transfer
        console.log(`[stripe webhook] transfer.created ${transfer.id} amount=${transfer.amount}`)
        break
      }

      default:
        break
    }
  } catch (e) {
    console.error("[stripe webhook] V1 handler error:", e)
    return NextResponse.json({ error: "Handler failed" }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
