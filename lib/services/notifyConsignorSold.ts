import type { SupabaseClient } from "@supabase/supabase-js"
import { trackConsignmentSold } from "@/lib/klaviyo/track-consignor-event"

/**
 * Best-effort "your consigned board sold" notification to the consignor. Loads the order's
 * consignor, store, and payout, then fires the Klaviyo event. Idempotent at the Klaviyo layer via
 * the order-scoped unique id. Never throws — settlement must not fail on a notification error.
 */
export async function notifyConsignorSold(service: SupabaseClient, orderId: string): Promise<void> {
  try {
    const { data, error } = await service
      .from("orders")
      .select(
        "id, consignor_profile_id, consignor_earnings, listings (title), consignment_stores (name)",
      )
      .eq("id", orderId)
      .maybeSingle()

    if (error || !data) return

    const order = data as unknown as {
      id: string
      consignor_profile_id: string | null
      consignor_earnings: number | string | null
      listings: { title: string | null } | null
      consignment_stores: { name: string | null } | null
    }

    if (!order.consignor_profile_id) return

    await trackConsignmentSold({
      orderId: order.id,
      consignorProfileId: order.consignor_profile_id,
      storeName: order.consignment_stores?.name ?? "the shop",
      listingTitle: order.listings?.title ?? "your board",
      consignorEarningsUsd: order.consignor_earnings == null ? 0 : Number(order.consignor_earnings),
    })
  } catch (err) {
    console.error("[notifyConsignorSold] failed", { orderId, err })
  }
}
