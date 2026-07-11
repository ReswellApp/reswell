import type { SupabaseClient } from "@supabase/supabase-js"
import { relistOrderListingsAfterRefund } from "@/lib/services/listingRelist"
import { ensureOrderRefundedSellerThreadNotification } from "@/lib/services/postOrderRefundedThreadNotification"

/**
 * Post-commit side effects after a marketplace order is fully refunded:
 * re-list sold listings and notify the seller in /messages.
 */
export async function applyMarketplaceOrderRefundSideEffects(
  supabase: SupabaseClient,
  orderId: string,
): Promise<void> {
  await relistOrderListingsAfterRefund(supabase, orderId)
  await ensureOrderRefundedSellerThreadNotification(supabase, orderId)
}
