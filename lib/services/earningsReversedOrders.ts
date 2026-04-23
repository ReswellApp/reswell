import type { SupabaseClient } from "@supabase/supabase-js"
import { getStripe } from "@/lib/stripe-server"

type WalletTxRef = {
  reference_id?: string | null
  reference_type?: string | null
  amount?: string | number | null
}

/**
 * Order UUIDs for which seller earnings were reversed (refund / clawback), used to show Activity
 * rows as "Refunded" instead of "Available" after the fact.
 *
 * Sources: `orders.status`, seller `wallet_refund` ledger rows, and Stripe refund ids → PaymentIntent → order.
 */
export async function resolveReversedSellerOrderIds(
  supabase: SupabaseClient,
  sellerId: string,
  txRows: WalletTxRef[],
): Promise<string[]> {
  const reversed = new Set<string>()
  const orderIdCandidates = new Set<string>()

  for (const t of txRows) {
    const rid = typeof t.reference_id === "string" ? t.reference_id.trim() : ""
    if (!rid) continue
    const rt = t.reference_type
    if (rt === "order_pending_earnings" || rt === "order_seller_earnings" || rt === "wallet_refund") {
      orderIdCandidates.add(rid)
    }
    // Seller clawback is negative; buyer refund credits use the same reference_type but credit the wallet.
    if (rt === "wallet_refund" && parseFloat(String(t.amount ?? 0)) < 0) {
      reversed.add(rid)
    }
  }

  if (orderIdCandidates.size > 0) {
    const { data: orders } = await supabase
      .from("orders")
      .select("id, status")
      .eq("seller_id", sellerId)
      .in("id", [...orderIdCandidates])

    for (const o of orders ?? []) {
      if (o.status === "refunded" || o.status === "refunding") {
        reversed.add(o.id)
      }
    }
  }

  const stripeRefundIds = [
    ...new Set(
      txRows
        .filter(
          (t) =>
            t.reference_type === "stripe_refund" &&
            typeof t.reference_id === "string" &&
            t.reference_id.trim().length > 0,
        )
        .map((t) => t.reference_id!.trim()),
    ),
  ]

  if (stripeRefundIds.length > 0 && process.env.STRIPE_SECRET_KEY?.trim()) {
    try {
      const stripe = getStripe()
      for (const reId of stripeRefundIds) {
        try {
          const refund = await stripe.refunds.retrieve(reId)
          const pi = refund.payment_intent
          const piId =
            typeof pi === "string"
              ? pi
              : pi && typeof pi === "object" && "id" in pi
                ? String((pi as { id: string }).id)
                : null
          if (!piId) continue
          const { data: order } = await supabase
            .from("orders")
            .select("id")
            .eq("stripe_checkout_session_id", piId)
            .eq("seller_id", sellerId)
            .maybeSingle()
          if (order?.id) reversed.add(order.id)
        } catch {
          // Ignore individual refund lookup failures (deleted mode, bad id, etc.)
        }
      }
    } catch {
      // Stripe not configured or client init failed — order status + wallet_refund still apply.
    }
  }

  return [...reversed]
}
