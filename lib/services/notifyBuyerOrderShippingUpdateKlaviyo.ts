import type { SupabaseClient } from "@supabase/supabase-js"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { trackKlaviyoOrderShippingUpdate } from "@/lib/klaviyo/track-order-shipping-update"
import { resolveProfilePhoneE164 } from "@/lib/db/profilePersonalInfo"
import { createServiceRoleClient } from "@/lib/supabase/server"
import {
  parseOrderTrackingDetail,
  type OrderTrackingDetail,
} from "@/lib/shipping/order-tracking-detail"
import { resolveShippingSmsMilestoneTransition } from "@/lib/shipping/order-shipping-sms-milestone"
import { orderTrackingUpdateChanged } from "@/lib/shipping/order-tracking-update-key"

type OrderShippingUpdateRow = {
  buyer_id: string
  order_num: string | null
  fulfillment_method: string | null
  tracking_number: string | null
  tracking_carrier: string | null
  listings: { title: string | null } | { title: string | null }[] | null
}

/**
 * Emits **Order Shipping Update** when carrier tracking advances beyond the previous snapshot.
 * Skips the first persisted snapshot (buyers already get **Order Shipped** with tracking info).
 * Attaches buyer phone when on file; sets `sms_milestone` only on OFD / delivered / exception transitions.
 */
export async function notifyBuyerOrderShippingUpdateKlaviyo(
  supabase: SupabaseClient,
  orderId: string,
  previousDetailRaw: unknown,
  newDetail: OrderTrackingDetail,
): Promise<void> {
  const previousDetail = parseOrderTrackingDetail(previousDetailRaw)
  if (!orderTrackingUpdateChanged(previousDetail, newDetail)) return

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

  const smsMilestone = resolveShippingSmsMilestoneTransition(previousDetail, newDetail)

  await trackKlaviyoOrderShippingUpdate({
    buyerUserId: order.buyer_id,
    buyerEmail,
    buyerPhoneE164,
    orderId,
    orderNum: order.order_num,
    listingTitle: listingTitle || "Your order",
    trackingNumber,
    trackingCarrier: order.tracking_carrier,
    detail: newDetail,
    smsMilestone,
  })
}
