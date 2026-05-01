import type { SupabaseClient } from "@supabase/supabase-js"
import { getConversationForBuyerSeller } from "@/lib/db/conversations"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { trackKlaviyoOrderShipped } from "@/lib/klaviyo/track-order-shipped"

type OrderShipContext = {
  id: string
  buyer_id: string
  listing_id: string
}

type MarkShippedFilter = "seller_match" | "order_id_only"

async function applyMarkOrderShippedWithTracking(
  supabase: SupabaseClient,
  ctx: OrderShipContext,
  sellerUserId: string,
  trackingNumber: string,
  trackingCarrier: string | null,
  filter: MarkShippedFilter,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  let updateQuery = supabase
    .from("orders")
    .update({
      tracking_number: trackingNumber,
      tracking_carrier: trackingCarrier,
      delivery_status: "shipped",
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.id)

  if (filter === "seller_match") {
    updateQuery = updateQuery.eq("seller_id", sellerUserId)
  }

  const { error: updateErr } = await updateQuery

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
    "Funds stay on hold until the buyer receives the item and a Reswell admin approves your payout after verifying delivery.",
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

/**
 * Seller confirms the package was handed to the carrier after tracking (and optional label) already exists.
 * Does not overwrite tracking_number — sets delivery_status shipped and runs payout / buyer messaging / Klaviyo.
 */
export async function markOrderDispatchedBySeller(
  supabase: SupabaseClient,
  ctx: OrderShipContext,
  sellerUserId: string,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const { data: ord, error: fetchErr } = await supabase
    .from("orders")
    .select("tracking_number, tracking_carrier, delivery_status")
    .eq("id", ctx.id)
    .eq("seller_id", sellerUserId)
    .maybeSingle()

  if (fetchErr || !ord) {
    return { ok: false, error: "Order not found", status: 404 }
  }
  if ((ord as { delivery_status: string }).delivery_status !== "pending") {
    return { ok: false, error: "This order is not waiting for shipment confirmation.", status: 409 }
  }
  const tn = (ord as { tracking_number: string | null }).tracking_number?.trim() ?? ""
  if (!tn) {
    return { ok: false, error: "Tracking must be on the order before you mark it shipped.", status: 400 }
  }
  const trackingCarrier = (ord as { tracking_carrier: string | null }).tracking_carrier

  const { error: updateErr } = await supabase
    .from("orders")
    .update({
      delivery_status: "shipped",
      updated_at: new Date().toISOString(),
    })
    .eq("id", ctx.id)
    .eq("seller_id", sellerUserId)
    .eq("delivery_status", "pending")

  if (updateErr) {
    console.error("[markOrderDispatchedBySeller] order update:", updateErr)
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
    `Shipped — tracking for "${title}" is live:`,
    carrier ? `Carrier: ${carrier}` : null,
    `Tracking #: ${tn}`,
    "",
    "Funds stay on hold until the buyer confirms delivery on Reswell and a Reswell admin approves your payout.",
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
    trackingNumber: tn,
    trackingCarrier: carrier,
  })

  return { ok: true }
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
  return applyMarkOrderShippedWithTracking(
    supabase,
    ctx,
    sellerUserId,
    trackingNumber,
    trackingCarrier,
    "seller_match",
  )
}

/**
 * Same side effects as {@link markOrderShippedWithTracking}, but updates the order by id only.
 * Caller must use a service-role client and verify admin authorization at the route.
 */
export async function markOrderShippedWithTrackingAsAdmin(
  supabase: SupabaseClient,
  ctx: OrderShipContext,
  sellerUserId: string,
  trackingNumber: string,
  trackingCarrier: string | null,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  return applyMarkOrderShippedWithTracking(
    supabase,
    ctx,
    sellerUserId,
    trackingNumber,
    trackingCarrier,
    "order_id_only",
  )
}
