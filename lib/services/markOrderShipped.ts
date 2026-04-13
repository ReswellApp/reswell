import type { SupabaseClient } from "@supabase/supabase-js"
import { getConversationForBuyerSeller } from "@/lib/db/conversations"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { trackKlaviyoOrderShipped } from "@/lib/klaviyo/track-order-shipped"

type OrderShipContext = {
  id: string
  buyer_id: string
  listing_id: string
}

/**
 * Seller adds carrier tracking; updates order, payout hold, buyer thread, Klaviyo.
 * Used by manual tracking POST and ShipEngine label purchase.
 */
export async function markOrderShippedWithTracking(
  supabase: SupabaseClient,
  ctx: OrderShipContext,
  sellerUserId: string,
  trackingNumber: string,
  trackingCarrier: string | null,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { error: updateErr } = await supabase
    .from("orders")
    .update({
      tracking_number: trackingNumber,
      tracking_carrier: trackingCarrier,
      delivery_status: "shipped",
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.id)
    .eq("seller_id", sellerUserId)

  if (updateErr) {
    console.error("[markOrderShippedWithTracking] order update:", updateErr)
    return { ok: false, error: "Failed to update order", status: 500 }
  }

  await supabase
    .from("payouts")
    .update({
      hold_reason: "awaiting_delivery",
      updated_at: new Date().toISOString(),
    })
    .eq("order_id", ctx.id)

  const { data: listing } = await supabase
    .from("listings")
    .select("title")
    .eq("id", ctx.listing_id)
    .maybeSingle()

  const title = listing?.title ?? "your item"
  const carrier = trackingCarrier?.trim() || null
  const msgContent = [
    `Tracking added for "${title}":`,
    carrier ? `Carrier: ${carrier}` : null,
    `Tracking #: ${trackingNumber}`,
    "",
    "You'll be asked to confirm delivery once it arrives.",
  ]
    .filter((l) => l !== null)
    .join("\n")

  const conv = await getConversationForBuyerSeller(supabase, ctx.buyer_id, sellerUserId)

  if (conv) {
    await supabase.from("messages").insert({
      conversation_id: conv.id,
      sender_id: sellerUserId,
      content: msgContent,
    })
    await supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
        listing_id: ctx.listing_id,
      })
      .eq("id", conv.id)
  }

  let buyerEmail: string | null = null
  try {
    const svc = createServiceRoleClient()
    const { data: buyerAuth } = await svc.auth.admin.getUserById(ctx.buyer_id)
    buyerEmail = buyerAuth?.user?.email ?? null
  } catch {
    /* non-critical */
  }

  void trackKlaviyoOrderShipped({
    buyerUserId: ctx.buyer_id,
    buyerEmail,
    orderId: ctx.id,
    listingTitle: title,
    trackingNumber,
    trackingCarrier: carrier,
  })

  return { ok: true }
}
