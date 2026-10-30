import {
  mobileSalesSchema,
  mobileSaleVerifyPickupSchema,
  type MobileSaleDetail,
  type MobileSaleListItem,
  type MobileSaleVerifyPickup,
} from "@reswell/api-contract"
import {
  ensureConversationForBuyerSellerListing,
  getConversationForBuyerSellerListing,
} from "@/lib/db/conversations"
import { getMobileSaleDetailRow, listMobileSaleRows } from "@/lib/db/mobile-sales"
import { getOrderReturnSummariesByOrderIds } from "@/lib/db/orderReturnStatusSummary"
import { fetchOrderIdsWithPreparedShippingLabels } from "@/lib/db/orderShippingLabels"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { compareSalesForSellerList, type SaleFulfillmentFilterInput } from "@/lib/sale-fulfillment-filters"
import { broadcastInsertedMarketplaceMessage } from "@/lib/services/broadcastMarketplaceThreadMessage"
import type { MobileApiResult } from "@/lib/services/mobileApi"
import { loadMobileOrderParty } from "@/lib/services/mobileOrderParty"
import {
  absoluteTrackUrl,
  buildMobileSaleDetail,
  filterInputForRow,
  toMobileSaleListItem,
} from "@/lib/services/mobileSalesMap"
import { mobileSaleHasLabel } from "@/lib/services/mobileSaleLabel"
import { verifyOrderPickupForSeller } from "@/lib/services/orderPickupVerification"
import { packageTrackHref } from "@/lib/utils/carrier-tracking-url"
import type { OrderCompletedMessagePayload } from "@/lib/validations/order-completed-message-metadata"
import type { SupabaseClient } from "@supabase/supabase-js"

export { buildMobileSaleDetail, toMobileSaleListItem } from "@/lib/services/mobileSalesMap"

export async function listMobileSalesService(
  supabase: SupabaseClient,
  userId: string,
): Promise<MobileApiResult<{ sales: MobileSaleListItem[] }>> {
  const listed = await listMobileSaleRows(supabase, userId)
  if (!listed.ok) return { ok: false, status: 500, error: "Unable to load sales right now" }

  const orderIds = listed.rows.map((row) => row.id)
  const [preparedLabelOrderIds, returnSummaries] = await Promise.all([
    fetchOrderIdsWithPreparedShippingLabels(supabase, orderIds),
    getOrderReturnSummariesByOrderIds(supabase, orderIds),
  ])

  const mapped = listed.rows
    .map((row) => {
      const item = toMobileSaleListItem(row, {
        preparedLabel: preparedLabelOrderIds.has(row.id),
        returnSummary: returnSummaries.get(row.id) ?? null,
      })
      if (!item) return null
      return {
        item,
        createdAt: row.created_at,
        filterInput: filterInputForRow(row, preparedLabelOrderIds.has(row.id)),
      }
    })
    .filter(
      (
        entry,
      ): entry is {
        item: MobileSaleListItem
        createdAt: string
        filterInput: SaleFulfillmentFilterInput
      } => entry != null,
    )
    .sort((a, b) =>
      compareSalesForSellerList(
        { createdAt: a.createdAt, filterInput: a.filterInput },
        { createdAt: b.createdAt, filterInput: b.filterInput },
      ),
    )
    .map((entry) => entry.item)

  const parsed = mobileSalesSchema.safeParse({ sales: mapped })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to load sales right now" }
  return { ok: true, data: parsed.data }
}

export async function getMobileSaleDetailService(
  supabase: SupabaseClient,
  userId: string,
  orderId: string,
): Promise<MobileApiResult<MobileSaleDetail>> {
  const loaded = await getMobileSaleDetailRow(supabase, userId, orderId)
  if (!loaded.ok) return { ok: false, status: 500, error: "Unable to load this sale right now" }
  if (!loaded.rows) return { ok: false, status: 404, error: "Sale not found" }

  const order = loaded.rows
  const listingId = order.listing_id.trim() || order.listing?.id || null
  const [conversation, preparedIds, returnSummaries, hasLabel, buyer] = await Promise.all([
    order.buyer_id
      ? getConversationForBuyerSellerListing(supabase, order.buyer_id, userId, listingId)
      : Promise.resolve(null),
    fetchOrderIdsWithPreparedShippingLabels(supabase, [orderId]),
    getOrderReturnSummariesByOrderIds(supabase, [orderId]),
    mobileSaleHasLabel(supabase, userId, orderId, order.tracking_number),
    loadMobileOrderParty(supabase, order.buyer_id, {
      viewerId: userId,
      fallbackName: order.buyer_name,
    }),
  ])
  const labelAvailable = hasLabel

  const detail = buildMobileSaleDetail(order, {
    conversationId: conversation?.id ?? null,
    labelAvailable,
    preparedLabel: preparedIds.has(orderId),
    returnSummary: returnSummaries.get(orderId) ?? null,
    trackUrl: order.tracking_number?.trim()
      ? absoluteTrackUrl(
          packageTrackHref({
            orderId: order.id,
            trackingNumber: order.tracking_number,
            trackingCarrier: order.tracking_carrier,
          }),
        )
      : null,
    buyer,
  })
  if (!detail) return { ok: false, status: 500, error: "Unable to load this sale right now" }
  return { ok: true, data: detail }
}

function buildPickupCompleteThreadPlainText(params: { orderNum: string; listingTitle: string }): string {
  const header = `Order #${params.orderNum} — pickup complete`
  const itemLine = `Item: "${params.listingTitle}"`
  const tail = "Pickup confirmed. View your order or sale dashboard anytime for details."
  return [header, "", itemLine, "", tail].join("\n")
}

export async function verifyMobileSalePickupService(
  supabase: SupabaseClient,
  userId: string,
  orderId: string,
  code: string,
): Promise<MobileApiResult<MobileSaleVerifyPickup>> {
  const result = await verifyOrderPickupForSeller(supabase, { orderId, code })
  if (!result.ok) return { ok: false, status: result.status, error: result.error }

  const [{ data: listing }, { data: orderRow }] = await Promise.all([
    supabase.from("listings").select("title").eq("id", result.listingId).maybeSingle(),
    supabase.from("orders").select("order_num, seller_id").eq("id", orderId).maybeSingle(),
  ])
  const sellerId = (orderRow as { seller_id?: string | null } | null)?.seller_id
  if (sellerId && sellerId !== userId) {
    return { ok: false, status: 403, error: "Unauthorized" }
  }

  const listingTitle = (listing as { title?: string | null } | null)?.title?.trim() || "the item"
  const orderNum = formatOrderNumForCustomer(
    (orderRow as { order_num?: string | null } | null)?.order_num ?? null,
    orderId,
  )
  const metadata: OrderCompletedMessagePayload = {
    kind: "order_completed",
    orderId,
    orderNum,
    listingTitle,
  }

  let conv = await getConversationForBuyerSellerListing(
    supabase,
    result.buyerId,
    userId,
    result.listingId,
  )
  if (!conv) {
    const ensured = await ensureConversationForBuyerSellerListing(
      supabase,
      result.buyerId,
      userId,
      result.listingId,
    )
    if (ensured) conv = { id: ensured.id, listing_id: result.listingId }
  }

  if (conv) {
    const pickupContent = buildPickupCompleteThreadPlainText({ orderNum, listingTitle })
    const now = new Date().toISOString()
    const { data: inserted } = await supabase
      .from("messages")
      .insert({
        conversation_id: conv.id,
        sender_id: userId,
        content: pickupContent,
        metadata,
      })
      .select("id, created_at")
      .single()
    if (inserted) {
      await broadcastInsertedMarketplaceMessage(
        { ...inserted, sender_id: userId, content: pickupContent, metadata },
        conv.id,
      )
    }
    await supabase.from("conversations").update({ last_message_at: now }).eq("id", conv.id)
  }

  const parsed = mobileSaleVerifyPickupSchema.safeParse({ ok: true })
  if (!parsed.success) return { ok: false, status: 500, error: "Unable to verify pickup right now" }
  return { ok: true, data: parsed.data }
}
