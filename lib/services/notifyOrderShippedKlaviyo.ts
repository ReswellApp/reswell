import type { SupabaseClient } from "@supabase/supabase-js"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { getSellerEmailForKlaviyo } from "@/lib/klaviyo/seller-sale-event-helpers"
import { trackKlaviyoOrderShipped } from "@/lib/klaviyo/track-order-shipped"
import { trackKlaviyoSellerOrderShipped } from "@/lib/klaviyo/track-seller-order-shipped"
import { findSentKlaviyoUniqueIds } from "@/lib/db/klaviyoEventLog"
import { resolveProfilePhoneE164 } from "@/lib/db/profilePersonalInfo"

type OrderShippedNotifyRow = {
  id: string
  order_num: string | null
  buyer_id: string
  seller_id: string
  fulfillment_method: string | null
  delivery_status: string
  tracking_number: string | null
  tracking_carrier: string | null
  listings: { title: string | null } | { title: string | null }[] | null
}

function listingTitleFromEmbed(
  listings: OrderShippedNotifyRow["listings"],
): string {
  const row = Array.isArray(listings) ? listings[0] : listings
  const title = row?.title?.trim()
  return title || "your item"
}

async function shippedKlaviyoEventsAlreadySent(
  orderId: string,
): Promise<{ buyer: boolean; seller: boolean }> {
  const buyerId = `order-shipped-${orderId}`
  const sellerId = `seller-order-shipped-${orderId}`
  const ids = await findSentKlaviyoUniqueIds([buyerId, sellerId])
  return {
    buyer: ids.has(buyerId),
    seller: ids.has(sellerId),
  }
}

/**
 * Emits buyer **Order Shipped** and seller **Seller Order Shipped**.
 * Idempotent per order via Klaviyo uniqueIds and the event log.
 */
export async function notifyOrderShippedKlaviyoIfMissing(
  supabase: SupabaseClient,
  orderId: string,
): Promise<void> {
  const already = await shippedKlaviyoEventsAlreadySent(orderId)
  if (already.buyer && already.seller) return

  const { data: row, error } = await supabase
    .from("orders")
    .select(
      "id, order_num, buyer_id, seller_id, fulfillment_method, delivery_status, tracking_number, tracking_carrier, listings ( title )",
    )
    .eq("id", orderId)
    .maybeSingle()

  if (error || !row) {
    if (error) {
      console.error("[notifyOrderShippedKlaviyo] order load:", error.message)
    }
    return
  }

  const order = row as OrderShippedNotifyRow
  if (order.fulfillment_method !== "shipping") return
  if (order.delivery_status !== "shipped" && order.delivery_status !== "delivered") return

  const trackingNumber = order.tracking_number?.trim() ?? ""
  if (!trackingNumber) return

  const listingTitle = listingTitleFromEmbed(order.listings)
  const trackingCarrier = order.tracking_carrier?.trim() || null

  let buyerEmail: string | null = null
  let buyerPhoneE164: string | null = null
  let sellerEmail: string | null = null
  try {
    const svc = createServiceRoleClient()
    const { data: buyerAuth } = await svc.auth.admin.getUserById(order.buyer_id)
    const authPhone = buyerAuth?.user?.phone?.trim() || null
    const [email, phone, seller] = await Promise.all([
      getAuthEmailForUserId(order.buyer_id),
      resolveProfilePhoneE164(svc, order.buyer_id, authPhone),
      getSellerEmailForKlaviyo(order.seller_id),
    ])
    buyerEmail = email
    buyerPhoneE164 = phone
    sellerEmail = seller
  } catch {
    /* non-critical — events can still send with external_id only */
  }

  if (!already.buyer) {
    await trackKlaviyoOrderShipped({
      buyerUserId: order.buyer_id,
      buyerEmail,
      buyerPhoneE164,
      orderId: order.id,
      listingTitle,
      trackingNumber,
      trackingCarrier,
    })
  }

  if (!already.seller) {
    await trackKlaviyoSellerOrderShipped({
      sellerUserId: order.seller_id,
      sellerEmail,
      orderId: order.id,
      orderNum: order.order_num,
      listingTitle,
      trackingNumber,
      trackingCarrier,
    })
  }
}
