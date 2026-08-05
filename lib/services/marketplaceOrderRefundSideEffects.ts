import type { SupabaseClient } from "@supabase/supabase-js"
import { relistOrderListingsAfterRefund } from "@/lib/services/listingRelist"
import {
  planMarketplaceOrderRefundSideEffects,
  resolveMarketplaceOrderRefundDisposition,
  type MarketplaceOrderRefundDisposition,
} from "@/lib/services/marketplaceOrderRefundDisposition"
import { ensureOrderExclusiveRepurchaseThreadNotification } from "@/lib/services/postOrderExclusiveRepurchaseThreadNotification"
import { ensureOrderRefundedSellerThreadNotification } from "@/lib/services/postOrderRefundedThreadNotification"

/**
 * Post-commit side effects after a marketplace order is fully refunded.
 * Disposition controls listing visibility and whether the buyer gets a repurchase message.
 */
export async function applyMarketplaceOrderRefundSideEffects(
  supabase: SupabaseClient,
  orderId: string,
  dispositionOverride?: MarketplaceOrderRefundDisposition,
): Promise<void> {
  let disposition = dispositionOverride
  if (!disposition) {
    const { data: order, error } = await supabase
      .from("orders")
      .select("refund_disposition")
      .eq("id", orderId)
      .maybeSingle()
    if (error) {
      console.error("[refund side effects] load disposition", { orderId, error })
    }
    disposition = resolveMarketplaceOrderRefundDisposition(
      (order as { refund_disposition?: string | null } | null)?.refund_disposition,
    )
  }

  const plan = planMarketplaceOrderRefundSideEffects(disposition)

  await relistOrderListingsAfterRefund(supabase, orderId, {
    listingVisibility: plan.listingVisibility,
    grantExclusiveBuyerWindow: plan.grantExclusiveBuyerWindow,
  })
  await ensureOrderRefundedSellerThreadNotification(supabase, orderId)
  if (plan.notifyExclusiveRepurchase) {
    await ensureOrderExclusiveRepurchaseThreadNotification(supabase, orderId)
  }
}
