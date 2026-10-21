import type { SupabaseClient } from "@supabase/supabase-js"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import {
  orderShippingUpdateEventId,
  trackKlaviyoOrderShippingUpdate,
} from "@/lib/klaviyo/track-order-shipping-update"
import { findSentKlaviyoUniqueIds } from "@/lib/db/klaviyoEventLog"
import { resolveProfilePhoneE164 } from "@/lib/db/profilePersonalInfo"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { ensureOrderBrandedTrackingUrl } from "@/lib/services/ensureOrderBrandedTrackingUrl"
import { preferredTrackingUrl } from "@/lib/utils/carrier-tracking-url"
import {
  parseOrderTrackingDetail,
  type OrderTrackingDetail,
} from "@/lib/shipping/order-tracking-detail"
import { buyerShippingUpdateToEmit } from "@/lib/shipping/order-shipping-sms-milestone"

type OrderShippingUpdateRow = {
  buyer_id: string
  order_num: string | null
  fulfillment_method: string | null
  tracking_number: string | null
  tracking_carrier: string | null
  listings: { title: string | null } | { title: string | null }[] | null
}

/**
 * Emits **Order Shipping Update** only for a new buyer milestone: out for delivery,
 * delivery attempt, available for pickup, exception, or delivered.
 * Facility hops stay on the order page. Skips the first persisted snapshot
 * (buyers already get **Order Shipped**) and a milestone already sent for this order.
 * Attaches buyer phone when on file. `sms_milestone` is always one of
 * `out_for_delivery`, `delivered`, or `exception` (attempts and pickup use `exception`).
 */
export async function notifyBuyerOrderShippingUpdateKlaviyo(
  supabase: SupabaseClient,
  orderId: string,
  previousDetailRaw: unknown,
  newDetail: OrderTrackingDetail,
): Promise<void> {
  const previousDetail = parseOrderTrackingDetail(previousDetailRaw)
  const notification = buyerShippingUpdateToEmit(previousDetail, newDetail)
  if (!notification) return

  const eventId = orderShippingUpdateEventId(orderId, notification.dedupeKey)
  const alreadySent = await findSentKlaviyoUniqueIds([eventId])
  if (alreadySent.has(eventId)) return

  const { data: row, error } = await supabase
    .from("orders")
    .select(
      "buyer_id, order_num, fulfillment_method, tracking_number, tracking_carrier, listings ( title )",
    )
    .eq("id", orderId)
    .maybeSingle()

  if (error || !row) {
    if (error) {
      console.error("[notifyBuyerOrderShippingUpdateKlaviyo] order load:", error.message)
    }
    return
  }

  const order = row as OrderShippingUpdateRow
  if (order.fulfillment_method !== "shipping") return

  const trackingNumber = order.tracking_number?.trim() ?? ""
  if (!trackingNumber) return

  const listingEmbed = order.listings
  const listingTitle = Array.isArray(listingEmbed)
    ? (listingEmbed[0]?.title ?? "")
    : (listingEmbed?.title ?? "")

  let buyerEmail: string | null = null
  let buyerPhoneE164: string | null = null
  try {
    const admin = createServiceRoleClient()
    const { data: buyerAuth } = await admin.auth.admin.getUserById(order.buyer_id)
    const authPhone = buyerAuth?.user?.phone?.trim() || null
    const [email, phone] = await Promise.all([
      getAuthEmailForUserId(order.buyer_id),
      resolveProfilePhoneE164(admin, order.buyer_id, authPhone),
    ])
    buyerEmail = email
    buyerPhoneE164 = phone
  } catch {
    /* non-critical */
  }

  const brandedUrl = await ensureOrderBrandedTrackingUrl(orderId)
  const trackingUrl = preferredTrackingUrl({
    brandedUrl,
    trackingNumber,
    trackingCarrier: order.tracking_carrier,
  })

  await trackKlaviyoOrderShippingUpdate({
    buyerUserId: order.buyer_id,
    buyerEmail,
    buyerPhoneE164,
    orderId,
    orderNum: order.order_num,
    listingTitle: listingTitle || "Your order",
    trackingNumber,
    trackingCarrier: order.tracking_carrier,
    trackingUrl,
    detail: newDetail,
    smsMilestone: notification.smsMilestone,
    notificationKind: notification.kind,
    dedupeKey: notification.dedupeKey,
  })
}
