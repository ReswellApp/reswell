import type { SupabaseClient } from "@supabase/supabase-js"
import { getAuthEmailForUserId } from "@/lib/klaviyo/auth-user-email"
import { trackKlaviyoOrderShippingUpdate } from "@/lib/klaviyo/track-order-shipping-update"
import { resolveProfilePhoneE164 } from "@/lib/db/profilePersonalInfo"
import { createServiceRoleClient } from "@/lib/supabase/server"
import { ensureOrderBrandedTrackingUrl } from "@/lib/services/ensureOrderBrandedTrackingUrl"
import { preferredTrackingUrl } from "@/lib/utils/carrier-tracking-url"
import {
  parseOrderTrackingDetail,
  type OrderTrackingDetail,
} from "@/lib/shipping/order-tracking-detail"
import {
  claimOrderShippingMilestone,
  listOrderShippingMilestoneClaims,
  releaseOrderShippingMilestoneClaim,
} from "@/lib/db/orderShippingMilestoneClaims"
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
 * Out for delivery, delivered, and exception each send once per order. The
 * claim row is the lock, so a webhook, the cron, and a purchase-page refresh
 * can all observe the same scan and only one of them texts. Opening a purchase
 * does not email ordinary in-transit scans; pass `notifyScanUpdates` from the
 * webhook and cron for those.
 *
 * Attaches buyer phone when on file. `sms_milestone` is set only on a claimed
 * milestone. Scan emails leave it empty.
 */
export async function notifyBuyerOrderShippingUpdateKlaviyo(
  supabase: SupabaseClient,
  orderId: string,
  previousDetailRaw: unknown,
  newDetail: OrderTrackingDetail,
  options?: { notifyScanUpdates?: boolean },
): Promise<void> {
  const previousDetail = parseOrderTrackingDetail(previousDetailRaw)
  const claimedMilestones = await listOrderShippingMilestoneClaims(supabase, orderId)
  const plan = planOrderShippingNotification({
    previous: previousDetail,
    next: newDetail,
    claimedMilestones,
    notifyScanUpdates: options?.notifyScanUpdates === true,
  })
  if (plan.kind === "skip") return

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

  let milestoneClaim: "out_for_delivery" | "delivered" | "exception" | null = null
  if (plan.kind === "milestone") {
    const claim = await claimOrderShippingMilestone(supabase, orderId, plan.milestone)
    if (claim !== "claimed") return
    milestoneClaim = plan.milestone
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
    const brandedUrl = await ensureOrderBrandedTrackingUrl(orderId)
    const trackingUrl = preferredTrackingUrl({
      brandedUrl,
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
      smsMilestone: milestoneClaim,
    })

    const accepted = sent.ok || sent.status === 409
    if (milestoneClaim && !accepted) {
      await releaseOrderShippingMilestoneClaim(supabase, orderId, milestoneClaim)
    }
  } catch (error) {
    if (milestoneClaim) {
      await releaseOrderShippingMilestoneClaim(supabase, orderId, milestoneClaim)
    }
    throw error
  }
}
