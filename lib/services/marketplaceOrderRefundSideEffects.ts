import type { SupabaseClient } from "@supabase/supabase-js"
import { relistOrderListingsAfterRefund } from "@/lib/services/listingRelist"
import { ensureOrderExclusiveRepurchaseThreadNotification } from "@/lib/services/postOrderExclusiveRepurchaseThreadNotification"
import { ensureOrderRefundedSellerThreadNotification } from "@/lib/services/postOrderRefundedThreadNotification"

/**
 * Post-commit side effects after a marketplace order is fully refunded:
 * re-list sold listings, notify participants in /messages, and send exclusive repurchase follow-up.
 */
export async function applyMarketplaceOrderRefundSideEffects(
  supabase: SupabaseClient,
  orderId: string,
): Promise<void> {
  await relistOrderListingsAfterRefund(supabase, orderId)
  await ensureOrderRefundedSellerThreadNotification(supabase, orderId)
  await ensureOrderExclusiveRepurchaseThreadNotification(supabase, orderId)
}
