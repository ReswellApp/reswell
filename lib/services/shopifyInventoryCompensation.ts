import type { SupabaseClient } from "@supabase/supabase-js"
import {
  dbBeginShopifyInventoryCompensation,
  dbGetShopifyCompensationPaymentIntent,
  dbMarkShopifyCompensatedOrderRefunded,
  dbUpdateShopifyInventoryCompensation,
} from "@/lib/db/shopifyCompensations"
import { getStripe } from "@/lib/stripe-server"

export type ShopifyInventoryCompensationResult =
  | "refunded"
  | "refunding"
  | "failed"

export async function compensateShopifyInventoryConflict(input: {
  serviceSupabase: SupabaseClient
  orderId: string
  paymentIntentId?: string
}): Promise<ShopifyInventoryCompensationResult> {
  const paymentIntentId =
    input.paymentIntentId ??
    (await dbGetShopifyCompensationPaymentIntent(
      input.serviceSupabase,
      input.orderId,
    ))
  if (!paymentIntentId) return "failed"

  try {
    await dbBeginShopifyInventoryCompensation(
      input.serviceSupabase,
      input.orderId,
      paymentIntentId,
    )
    const refund = await getStripe().refunds.create(
      {
        payment_intent: paymentIntentId,
        reason: "requested_by_customer",
        metadata: { reswell_reason: "shopify_inventory_conflict" },
      },
      { idempotencyKey: `shopify-inventory-conflict:${paymentIntentId}` },
    )
    if (refund.status === "succeeded") {
      await dbUpdateShopifyInventoryCompensation(
        input.serviceSupabase,
        input.orderId,
        { status: "refunded", stripeRefundId: refund.id },
      )
      await dbMarkShopifyCompensatedOrderRefunded(
        input.serviceSupabase,
        input.orderId,
      )
      return "refunded"
    }
    if (refund.status === "failed" || refund.status === "canceled") {
      await dbUpdateShopifyInventoryCompensation(
        input.serviceSupabase,
        input.orderId,
        {
          status: "failed",
          stripeRefundId: refund.id,
          error: `Stripe refund ${refund.status}`,
        },
      )
      return "failed"
    }
    await dbUpdateShopifyInventoryCompensation(
      input.serviceSupabase,
      input.orderId,
      { status: "refunding", stripeRefundId: refund.id },
    )
    return "refunding"
  } catch (error) {
    try {
      await dbUpdateShopifyInventoryCompensation(
        input.serviceSupabase,
        input.orderId,
        {
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
        },
      )
    } catch {
      // Preparation can fail before the durable compensation row exists.
    }
    console.error("[shopify] inventory compensation failed", {
      orderId: input.orderId,
      error: error instanceof Error ? error.message : String(error),
    })
    return "failed"
  }
}
