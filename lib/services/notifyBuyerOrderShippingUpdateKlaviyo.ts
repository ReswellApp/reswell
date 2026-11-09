import type { SupabaseClient } from "@supabase/supabase-js"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import {
  orderShippingUpdateEventId,
  trackKlaviyoOrderShippingUpdate,
} from "@/lib/klaviyo/track-order-shipping-update"
import { findSentKlaviyoUniqueIds } from "@/lib/db/klaviyoEventLog"
import {
  claimBuyerNotifiedDelivered,
  releaseBuyerNotifiedDelivered,
} from "@/lib/db/orderBuyerNotifiedDelivered"
import { resolveProfilePhoneE164 } from "@/lib/db/profilePersonalInfo"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { preferredTrackingUrl } from "@/lib/utils/carrier-tracking-url"
import {
  parseOrderTrackingDetail,
  type OrderTrackingDetail,
} from "@/lib/shipping/order-tracking-detail"
import { planOrderShippingNotification } from "@/lib/shipping/order-shipping-notify-plan"

type OrderShippingUpdateRow = {
  buyer_id: string
  order_num: string | null
  fulfillment_method: string | null
  tracking_number: string | null
  tracking_carrier: string | null
  listings: { title: string | null } | { title: string | null }[] | null
}

/**
 * Emits **Order Shipping Update** from a carrier snapshot.
 *
 * Delivered is already on the order. `buyer_notified_delivered_at` is set
 * once, before the text, and that stamp is the check the next refresh sees.
 * The same out-for-delivery or exception milestone is already on the previous
 * snapshot. A repeat of a send we already logged is skipped, and Klaviyo
 * dedupes the stable event id the same way Order Shipped does.
 * Opening a purchase does not email ordinary in-transit scans; the webhook
 * and cron pass `notifyScanUpdates`.
 *
 * `deliveryAlreadyRecorded` must be the order's state before this refresh
 * writes `carrier_delivered_at`. The sync in the same request sets that column.
 */
export async function notifyBuyerOrderShippingUpdateKlaviyo(
  supabase: SupabaseClient,
  orderId: string,
  previousDetailRaw: unknown,
  newDetail: OrderTrackingDetail,
  options?: { notifyScanUpdates?: boolean; deliveryAlreadyRecorded?: boolean },
): Promise<void> {
  const previousDetail = parseOrderTrackingDetail(previousDetailRaw)
  const plan = planOrderShippingNotification({
    previous: previousDetail,
    next: newDetail,
    deliveryAlreadyRecorded: options?.deliveryAlreadyRecorded === true,
    notifyScanUpdates: options?.notifyScanUpdates === true,
  })
  if (plan.kind === "skip") return

  const smsMilestone = plan.kind === "milestone" ? plan.milestone : null
  const eventId = orderShippingUpdateEventId({
    orderId,
    detail: newDetail,
    smsMilestone,
  })
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

  let stampedDelivered = false
  if (smsMilestone === "delivered") {
    const claim = await claimBuyerNotifiedDelivered(supabase, orderId)
    if (claim === "already") return
    stampedDelivered = claim === "claimed"
  }

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

  try {
    const trackingUrl = preferredTrackingUrl({
      orderId,
      trackingNumber,
      trackingCarrier: order.tracking_carrier,
    })

    const sent = await trackKlaviyoOrderShippingUpdate({
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
      smsMilestone,
    })

    const accepted = sent.ok || sent.status === 409
    if (stampedDelivered && !accepted) {
      await releaseBuyerNotifiedDelivered(supabase, orderId)
    }
  } catch (error) {
    if (stampedDelivered) {
      await releaseBuyerNotifiedDelivered(supabase, orderId)
    }
    throw error
  }
}
