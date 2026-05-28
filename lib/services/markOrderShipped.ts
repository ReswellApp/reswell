import type { SupabaseClient } from "@supabase/supabase-js"
import { getConversationForBuyerSellerListing, ensureConversationForBuyerSellerListing } from "@/lib/db/conversations"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { trackKlaviyoOrderShipped } from "@/lib/klaviyo/track-order-shipped"
import { parseOrderShippedMessageMetadata } from "@/lib/validations/order-shipped-message-metadata"
import type { OrderShippedMessagePayload } from "@/lib/validations/order-shipped-message-metadata"

type OrderShipContext = {
  id: string
  buyer_id: string
  listing_id: string
}

type MarkShippedFilter = "seller_match" | "order_id_only"

async function resolveListingThread(
  supabase: SupabaseClient,
  buyerId: string,
  sellerUserId: string,
  listingId: string,
): Promise<{ id: string; listing_id: string } | null> {
  let conv = await getConversationForBuyerSellerListing(
    supabase,
    buyerId,
    sellerUserId,
    listingId,
  )

  if (!conv) {
    const ensured = await ensureConversationForBuyerSellerListing(
      supabase,
      buyerId,
      sellerUserId,
      listingId,
    )
    if (ensured) {
      conv = { id: ensured.id, listing_id: listingId }
    }
  }

  return conv
}

async function orderShippedNotificationAlreadySent(
  supabase: SupabaseClient,
  conversationId: string,
  orderId: string,
): Promise<boolean> {
  const { data: rows } = await supabase
    .from("messages")
    .select("metadata")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(40)

  for (const row of rows ?? []) {
    const parsed = parseOrderShippedMessageMetadata(row.metadata)
    if (parsed?.orderId === orderId) return true
  }
  return false
}

async function postOrderShippedNotification(
  supabase: SupabaseClient,
  ctx: OrderShipContext,
  sellerUserId: string,
  trackingNumber: string,
  trackingCarrier: string | null,
  listingTitle: string,
): Promise<void> {
  const conv = await resolveListingThread(
    supabase,
    ctx.buyer_id,
    sellerUserId,
    ctx.listing_id,
  )
  if (!conv) return

  const alreadySent = await orderShippedNotificationAlreadySent(supabase, conv.id, ctx.id)
  if (alreadySent) return

  const carrier = trackingCarrier?.trim() || null
  const msgContent = [
    `Shipped — tracking for "${listingTitle}":`,
    carrier ? `Carrier: ${carrier}` : null,
    `Tracking #: ${trackingNumber}`,
    "",
    "Funds stay on hold until the buyer confirms delivery on Reswell and a Reswell admin approves your payout.",
  ]
    .filter((l) => l !== null)
    .join("\n")

  const metadata: OrderShippedMessagePayload = {
    kind: "order_shipped",
    orderId: ctx.id,
  }

  await supabase.from("messages").insert({
    conversation_id: conv.id,
    sender_id: sellerUserId,
    content: msgContent,
    metadata,
  })
  await supabase
    .from("conversations")
    .update({ last_message_at: new Date().toISOString() })
    .eq("id", conv.id)

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
    listingTitle,
    trackingNumber,
    trackingCarrier: carrier,
  })
}

/**
 * Seller saves carrier tracking on a pending shipping order (their own label / carrier).
 * Marks the order shipped and notifies the buyer — not used for Reswell auto-label purchase.
 */
export async function saveOrderTracking(
  supabase: SupabaseClient,
  orderId: string,
  sellerUserId: string,
  trackingNumber: string,
  trackingCarrier: string | null,
): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const trimmed = trackingNumber.trim()
  if (!trimmed) {
    return { ok: false, error: "Tracking number is required", status: 400 }
  }

  const carrier = trackingCarrier?.trim() || null

  const { data, error: rpcErr } = await supabase.rpc("save_order_tracking_for_seller", {
    p_order_id: orderId,
    p_tracking_number: trimmed,
    p_tracking_carrier: carrier,
  })

  if (!rpcErr && data) {
    const result = data as {
      ok: boolean
      error?: string
      tracking_number?: string
    }

    if (result.ok && result.tracking_number?.trim()) {
      await autoDispatchOrderIfTrackingReady(supabase, orderId, sellerUserId)
      return { ok: true }
    }

    if (!result.ok) {
      const mapped: Record<string, { error: string; status: number }> = {
        unauthorized: { error: "Unauthorized", status: 401 },
        tracking_required: { error: "Tracking number is required", status: 400 },
        not_found: { error: "Order not found", status: 404 },
        not_shipping: { error: "Tracking only applies to shipping orders", status: 400 },
        not_pending: {
          error: "Tracking can only be updated while the order is awaiting shipment.",
          status: 409,
        },
      }
      const fallback = { error: "Failed to save tracking", status: 500 }
      const out = mapped[result.error ?? ""] ?? fallback
      return { ok: false, ...out }
    }
  }

  const rpcMissing =
    rpcErr &&
    (rpcErr.code === "PGRST202" ||
      rpcErr.message?.includes("save_order_tracking_for_seller") ||
      rpcErr.message?.includes("Could not find the function"))

  if (rpcErr && !rpcMissing) {
    console.error("[saveOrderTracking] rpc error:", rpcErr)
    return { ok: false, error: "Failed to save tracking", status: 500 }
  }

  if (rpcMissing) {
    console.warn("[saveOrderTracking] RPC missing — falling back to direct update")
  }

  const { data: ord, error: fetchErr } = await supabase
    .from("orders")
    .select("fulfillment_method, delivery_status")
    .eq("id", orderId)
    .eq("seller_id", sellerUserId)
    .maybeSingle()

  if (fetchErr || !ord) {
    return { ok: false, error: "Order not found", status: 404 }
  }

  if ((ord as { fulfillment_method: string | null }).fulfillment_method !== "shipping") {
    return { ok: false, error: "Tracking only applies to shipping orders", status: 400 }
  }

  if ((ord as { delivery_status: string }).delivery_status !== "pending") {
    return {
      ok: false,
      error: "Tracking can only be updated while the order is awaiting shipment.",
      status: 409,
    }
  }

  const { data: updated, error: updateErr } = await supabase
    .from("orders")
    .update({
      tracking_number: trimmed,
      tracking_carrier: carrier,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .eq("seller_id", sellerUserId)
    .eq("delivery_status", "pending")
    .select("id, tracking_number")
    .maybeSingle()

  if (updateErr) {
    console.error("[saveOrderTracking] order update:", updateErr)
    return { ok: false, error: "Failed to save tracking", status: 500 }
  }

  if (!updated?.tracking_number?.trim()) {
    console.error("[saveOrderTracking] update matched no rows or tracking not persisted")
    return { ok: false, error: "Failed to save tracking", status: 500 }
  }

  await autoDispatchOrderIfTrackingReady(supabase, orderId, sellerUserId)

  return { ok: true }
}

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

  await postOrderShippedNotification(
    supabase,
    ctx,
    sellerUserId,
    trackingNumber,
    trackingCarrier,
    title,
  )

  return { ok: true }
}

/**
 * When tracking is on a pending shipping order, mark it shipped and notify the buyer.
 * Used after Reswell auto-label purchase and when sellers save tracking manually.
 */
export async function autoDispatchOrderIfTrackingReady(
  supabase: SupabaseClient,
  orderId: string,
  sellerUserId: string,
): Promise<void> {
  const { data: ord, error: fetchErr } = await supabase
    .from("orders")
    .select("id, buyer_id, listing_id, delivery_status, tracking_number")
    .eq("id", orderId)
    .maybeSingle()

  if (fetchErr || !ord) {
    console.error("[autoDispatchOrderIfTrackingReady] order load:", fetchErr?.message ?? "not found")
    return
  }

  if ((ord as { delivery_status: string }).delivery_status !== "pending") return
  if (!(ord as { tracking_number: string | null }).tracking_number?.trim()) return

  const result = await markOrderDispatchedBySeller(
    supabase,
    {
      id: (ord as { id: string }).id,
      buyer_id: (ord as { buyer_id: string }).buyer_id,
      listing_id: (ord as { listing_id: string }).listing_id,
    },
    sellerUserId,
  )

  if (!result.ok) {
    console.error("[autoDispatchOrderIfTrackingReady]", result.error)
  }
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

  await postOrderShippedNotification(
    supabase,
    ctx,
    sellerUserId,
    tn,
    trackingCarrier,
    title,
  )

  return { ok: true }
}

/**
 * Marks order shipped with tracking and notifies buyer (admin / legacy flows).
 * Manual seller tracking uses {@link saveOrderTracking} + {@link markOrderDispatchedBySeller}.
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
