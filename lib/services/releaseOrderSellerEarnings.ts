import { createServiceRoleClient } from "@/lib/supabase/server"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { trackKlaviyoSellerOrderConfirmed } from "@/lib/klaviyo/track-seller-order-confirmed"

/**
 * After buyer confirms delivery or seller verifies pickup: credit seller Reswell Bucks balance
 * (funds were already captured at checkout — card charges settle on the platform Stripe account;
 * wallet purchases debited the buyer at purchase time). Idempotent per order.
 */
export async function releaseOrderSellerEarningsAfterFulfillment(
  orderId: string,
): Promise<{ ok: true; released: boolean } | { ok: false; error: string }> {
  let supabase
  try {
    supabase = createServiceRoleClient()
  } catch (e) {
    console.error("[releaseOrderSellerEarnings] service client", e)
    return { ok: false, error: "Server configuration error" }
  }

  const { data: didRelease, error: rpcErr } = await supabase.rpc(
    "release_order_seller_earnings_to_wallet",
    { p_order_id: orderId },
  )

  if (rpcErr) {
    console.error("[releaseOrderSellerEarnings] rpc", rpcErr)
    return { ok: false, error: "Could not release seller earnings" }
  }

  const releasedNew = didRelease === true

  if (releasedNew) {
    const { data: order } = await supabase
      .from("orders")
      .select(
        "id, order_num, buyer_id, seller_id, listing_id, amount, platform_fee, seller_earnings, fulfillment_method, payment_method",
      )
      .eq("id", orderId)
      .maybeSingle()

    const { data: listing } = order?.listing_id
      ? await supabase
          .from("listings")
          .select("id, title, section, slug")
          .eq("id", order.listing_id)
          .maybeSingle()
      : { data: null }

    if (order?.seller_id && listing && order.buyer_id !== order.seller_id) {
      const sellerEmail = await getAuthEmailForUserId(order.seller_id)
      const amount = Number(order.amount)
      const platformFee = Number(order.platform_fee)
      const sellerEarnings = Number(order.seller_earnings)
      await trackKlaviyoSellerOrderConfirmed({
        sellerUserId: order.seller_id,
        sellerEmail,
        orderId: order.id,
        orderNum: (order as { order_num?: string | null }).order_num ?? null,
        listingId: listing.id,
        listingTitle: listing.title ?? "",
        listingSection: listing.section ?? "",
        listingSlug: listing.slug ?? null,
        orderAmount: Number.isFinite(amount) ? amount : 0,
        sellerEarnings: Number.isFinite(sellerEarnings) ? sellerEarnings : 0,
        platformFee: Number.isFinite(platformFee) ? platformFee : 0,
        fulfillmentMethod: order.fulfillment_method === "pickup" ? "pickup" : "shipping",
        paymentMethod: order.payment_method === "stripe" ? "stripe" : "reswell_bucks",
      })
    }
  }

  return { ok: true, released: releasedNew }
}
