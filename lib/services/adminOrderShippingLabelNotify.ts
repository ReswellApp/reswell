import type { SupabaseClient } from "@supabase/supabase-js"
import { getConversationForBuyerSellerListing, ensureConversationForBuyerSellerListing } from "@/lib/db/conversations"
import {
  insertOrderAdminShippingLabel,
  type AdminShippingLabelSource,
} from "@/lib/db/adminOrderShippingLabels"
import { resolveOpenOrderShippingLabelFailures } from "@/lib/db/orderShippingLabelFailures"

/**
 * Records admin-supplied label/tracking on the order without marking it shipped.
 * Posts an in-app message to the buyer–seller thread (sender = admin).
 */
export async function attachAdminShippingLabelToOrder(params: {
  supabase: SupabaseClient
  adminUserId: string
  order: {
    id: string
    buyer_id: string
    seller_id: string
    listing_id: string
  }
  listingTitle: string
  displayOrderNum: string
  source: AdminShippingLabelSource
  labelPdfUrl: string | null
  labelStoragePath: string | null
  trackingNumber: string | null
  trackingCarrier: string | null
  shipengineRateId?: string | null
  labelCostUsd?: number | null
  labelCostCurrency?: string | null
}): Promise<{ ok: true } | { ok: false; error: string; status: number }> {
  const u = params.order
  const track = params.trackingNumber?.trim() || null
  const car = params.trackingCarrier?.trim() || null

  const ins = await insertOrderAdminShippingLabel(params.supabase, {
    order_id: u.id,
    created_by: params.adminUserId,
    source: params.source,
    label_pdf_url: params.labelPdfUrl,
    label_storage_path: params.labelStoragePath,
    tracking_number: track,
    tracking_carrier: car,
    shipengine_rate_id: params.shipengineRateId ?? null,
    label_cost_usd: params.labelCostUsd ?? null,
    label_cost_currency: params.labelCostCurrency ?? null,
  })
  if (ins.error) {
    console.error("[attachAdminShippingLabelToOrder] insert label row:", ins.error)
    const detail = ins.error.message.trim()
    return {
      ok: false,
      error: detail ? `Failed to save label record: ${detail}` : "Failed to save label record",
      status: 500,
    }
  }

  const orderPatch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }
  if (track) {
    orderPatch.tracking_number = track
    orderPatch.tracking_carrier = car
  }

  const { error: orderErr } = await params.supabase.from("orders").update(orderPatch).eq("id", u.id)

  if (orderErr) {
    console.error("[attachAdminShippingLabelToOrder] order update:", orderErr)
    return {
      ok: false,
      error: `Label record saved but order was not updated: ${orderErr.message}. Fix tracking on the order manually if needed.`,
      status: 500,
    }
  }

  const lines = [
    `Reswell (admin): shipping materials for order #${params.displayOrderNum} — ${params.listingTitle}`,
    "",
    params.labelPdfUrl ? `Label (PDF): ${params.labelPdfUrl}` : null,
    params.labelStoragePath
      ? `Label file uploaded to Reswell (${params.labelStoragePath.split("/").pop() ?? "PDF"}). Open your sale page to download.`
      : null,
    track ? `Tracking: ${track}` : null,
    car ? `Carrier: ${car}` : null,
    "",
    "Seller: print the label, pack the board, and hand it to the carrier. Use your sale page to confirm when it’s dropped off.",
    track
      ? "Buyer: this tracking number is on your order page. The seller confirms shipment after drop-off; then delivery protection and payout timing follow the normal flow."
      : "Buyer: the seller received the label here and on their sale page; tracking will appear on your order when it’s added.",
  ]
    .filter((l): l is string => l != null && l.length > 0)
    .join("\n")

  let conv = await getConversationForBuyerSellerListing(
    params.supabase,
    u.buyer_id,
    u.seller_id,
    u.listing_id,
  )

  if (!conv) {
    const ensured = await ensureConversationForBuyerSellerListing(
      params.supabase,
      u.buyer_id,
      u.seller_id,
      u.listing_id,
    )
    if (ensured) {
      conv = { id: ensured.id, listing_id: u.listing_id }
    }
  }

  if (conv) {
    const { error: msgErr } = await params.supabase.from("messages").insert({
      conversation_id: conv.id,
      sender_id: params.adminUserId,
      content: lines,
    })
    if (msgErr) {
      console.error("[attachAdminShippingLabelToOrder] message insert:", msgErr)
    }
    await params.supabase
      .from("conversations")
      .update({
        last_message_at: new Date().toISOString(),
      })
      .eq("id", conv.id)
  }

  void resolveOpenOrderShippingLabelFailures(params.supabase, u.id, params.adminUserId)

  return { ok: true }
}
