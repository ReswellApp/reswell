import type { SupabaseClient } from "@supabase/supabase-js"
import { fetchSellerShipFromLabelName } from "@/lib/db/sellerShipFromLabel"
import { fetchProfileAddresses } from "@/lib/db/profile-addresses"
import { deleteShipEngineLabelPurchaseLockForReplacement } from "@/lib/db/shipEngineLabelPurchaseLocks"
import {
  listLiveChatLabelEligibleOrdersForSeller,
  type LiveChatLabelEligibleOrder,
} from "@/lib/db/liveChatLabelEligibleOrders"
import { insertSupportCaseEvent } from "@/lib/db/supportCases"
import type { LiveChatSessionRow } from "@/lib/db/liveChat"
import type { ProfileAddressRow } from "@/lib/profile-address"
import { formatOrderNumForCustomer } from "@/lib/order-num-display"
import { PEER_SURFBOARD_CHECKOUT_LISTING_SELECT } from "@/lib/services/peerListingShippingQuote"
import { attachOrderShippingLabel } from "@/lib/services/attachOrderShippingLabel"
import { getCheapestReswellRateForListings } from "@/lib/services/reswellListingShippingRate"
import { purchaseShipEngineLabelForOrderOnce } from "@/lib/services/purchaseShipEngineLabelForOrderOnce"
import {
  downloadAndStoreLabelPdf,
  downloadAndStorePaperlessQr,
} from "@/lib/services/storeOrderShippingLabelAssets"
import { voidShipEngineLabelForOrder } from "@/lib/services/voidShipEngineLabelForOrder"
import {
  orderShippingJsonToRateQuoteAddress,
  rateQuoteFieldsToShippingInput,
} from "@/lib/shipping/rate-address"
import { saleIsAwaitingCarrierScan } from "@/lib/sale-fulfillment-filters"
import { parseOrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"
import { fetchOrderIdsWithPreparedShippingLabels } from "@/lib/db/orderShippingLabels"
import type { LiveChatLabelUpdateReason } from "@/lib/validations/liveChatLabelUpdate"

export type LiveChatShipFromAddressOption = {
  id: string
  label: string
  oneLine: string
  isDefault: boolean
}

export type LiveChatLabelUpdateBootstrap = {
  orders: LiveChatLabelEligibleOrder[]
  addresses: LiveChatShipFromAddressOption[]
  authRequired: boolean
}

function addressOneLine(addr: ProfileAddressRow): string {
  return [addr.line1, [addr.city, addr.state, addr.postal_code].filter(Boolean).join(", ")]
    .filter(Boolean)
    .join(" · ")
}

function toAddressOption(addr: ProfileAddressRow): LiveChatShipFromAddressOption {
  return {
    id: addr.id,
    label: addr.label?.trim() || "Address",
    oneLine: addressOneLine(addr),
    isDefault: addr.is_default,
  }
}

export async function bootstrapLiveChatLabelUpdate(params: {
  svc: SupabaseClient
  session: LiveChatSessionRow
}): Promise<LiveChatLabelUpdateBootstrap> {
  const userId = params.session.user_id
  if (!userId) {
    return { orders: [], addresses: [], authRequired: true }
  }

  const [orders, addressResult] = await Promise.all([
    listLiveChatLabelEligibleOrdersForSeller(params.svc, userId),
    fetchProfileAddresses(params.svc, userId),
  ])

  return {
    orders,
    addresses: addressResult.addresses.map(toAddressOption),
    authRequired: false,
  }
}

async function assertOrderEligibleForShipFromUpdate(
  svc: SupabaseClient,
  orderId: string,
  sellerId: string,
): Promise<
  | {
      ok: true
      order: {
        id: string
        order_num: string | null
        seller_id: string
        listing_id: string
        fulfillment_method: string | null
        delivery_status: string
        status: string
        shipping_address: unknown
        tracking_number: string | null
        tracking_detail: unknown
        listing: Record<string, unknown>
      }
    }
  | { ok: false; error: string }
> {
  const { data: orderRaw, error } = await svc
    .from("orders")
    .select(
      `
      id,
      order_num,
      seller_id,
      listing_id,
      fulfillment_method,
      delivery_status,
      status,
      shipping_address,
      tracking_number,
      tracking_detail,
      listings ( ${PEER_SURFBOARD_CHECKOUT_LISTING_SELECT} )
    `,
    )
    .eq("id", orderId)
    .maybeSingle()

  if (error || !orderRaw) return { ok: false, error: "Order not found." }
  const order = orderRaw as unknown as {
    id: string
    order_num: string | null
    seller_id: string
    listing_id: string
    fulfillment_method: string | null
    delivery_status: string
    status: string
    shipping_address: unknown
    tracking_number: string | null
    tracking_detail: unknown
    listings: Record<string, unknown> | Record<string, unknown>[] | null
  }
  if (String(order.seller_id) !== sellerId) {
    return { ok: false, error: "That sale is not on your account." }
  }

  const listingRaw = order.listings
  const listing = Array.isArray(listingRaw) ? listingRaw[0] : listingRaw
  if (!listing || typeof listing !== "object") {
    return { ok: false, error: "Listing not found for this order." }
  }

  const prepared = await fetchOrderIdsWithPreparedShippingLabels(svc, [orderId])
  const eligible = saleIsAwaitingCarrierScan({
    fulfillmentMethod: order.fulfillment_method,
    deliveryStatus: order.delivery_status,
    orderStatus: order.status,
    hasShippingAddress: Boolean(order.shipping_address),
    hasPreparedShippingLabel: prepared.has(orderId),
    trackingNumber: order.tracking_number,
    trackingDetail: parseOrderTrackingDetail(order.tracking_detail),
  })
  if (!eligible) {
    return {
      ok: false,
      error: "This label can only be updated before the carrier scans the package.",
    }
  }

  return {
    ok: true,
    order: {
      id: String(order.id),
      order_num: order.order_num,
      seller_id: String(order.seller_id),
      listing_id: String(order.listing_id),
      fulfillment_method: order.fulfillment_method,
      delivery_status: order.delivery_status,
      status: order.status,
      shipping_address: order.shipping_address,
      tracking_number: order.tracking_number,
      tracking_detail: order.tracking_detail,
      listing,
    },
  }
}

/**
 * Seller-only: void the current unscanned label and repurchase from a chosen
 * saved ship-from address. Does not change ship-to, parcel, or buyer data.
 */
export async function confirmLiveChatShipFromLabelUpdate(params: {
  svc: SupabaseClient
  session: LiveChatSessionRow
  orderId: string
  shipFromAddressId: string
  reason: LiveChatLabelUpdateReason
  reasonNote?: string
}): Promise<
  | {
      ok: true
      message: string
      trackingNumber: string
      orderNum: string
    }
  | { ok: false; error: string; code?: "auth_required" | "forbidden" }
> {
  const userId = params.session.user_id
  if (!userId) {
    return { ok: false, error: "Sign in to update a shipping label.", code: "auth_required" }
  }

  const loaded = await assertOrderEligibleForShipFromUpdate(params.svc, params.orderId, userId)
  if (!loaded.ok) return loaded

  const { addresses } = await fetchProfileAddresses(params.svc, userId)
  const shipFrom = addresses.find((row) => row.id === params.shipFromAddressId)
  if (!shipFrom) {
    return { ok: false, error: "Choose one of your saved ship-from addresses." }
  }

  const shipToFields = orderShippingJsonToRateQuoteAddress(loaded.order.shipping_address)
  if (!shipToFields) {
    return { ok: false, error: "Buyer shipping address on this order is incomplete." }
  }

  const sellerShipFromName = await fetchSellerShipFromLabelName(params.svc, userId)
  const quoted = await getCheapestReswellRateForListings({
    listings: [loaded.order.listing as never],
    shipTo: rateQuoteFieldsToShippingInput(shipToFields),
    diagnosticTag: `live-chat-ship-from:${params.orderId}`,
    sellerShipFromName,
    sellerShipFromAddress: shipFrom,
    selectedServiceCode: "usps_ground_advantage",
    section: (loaded.order.listing.section as string | null | undefined) ?? null,
  })
  if (!quoted.ok) {
    return { ok: false, error: quoted.error }
  }
  if (!quoted.cheapest.rate_id) {
    return { ok: false, error: "No purchasable shipping rate was returned." }
  }

  const { data: shipment } = await params.svc
    .from("order_shipments")
    .select("id")
    .eq("order_id", params.orderId)
    .order("sort_order", { ascending: true })
    .limit(1)
    .maybeSingle()
  const { data: items } = await params.svc
    .from("order_items")
    .select("id")
    .eq("order_id", params.orderId)
    .order("sort_order", { ascending: true })
    .limit(1)

  const shipmentId = typeof shipment?.id === "string" ? shipment.id : null
  const orderItemId = (items?.[0] as { id?: string } | undefined)?.id ?? null

  const voided = await voidShipEngineLabelForOrder({
    supabase: params.svc,
    orderId: params.orderId,
    explicitLabelId: null,
  })
  if (!voided.ok) {
    return { ok: false, error: voided.error }
  }

  await params.svc
    .from("orders")
    .update({
      tracking_number: null,
      tracking_carrier: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.orderId)

  if (shipmentId) {
    await params.svc
      .from("order_shipments")
      .update({
        tracking_number: null,
        tracking_carrier: null,
        tracking_detail: null,
        delivery_status: "pending",
        updated_at: new Date().toISOString(),
      })
      .eq("id", shipmentId)
  }

  await params.svc
    .from("order_shipping_labels")
    .update({ tracking_number: null, tracking_carrier: null })
    .eq("order_id", params.orderId)
    .not("tracking_number", "is", null)

  const lockCleared = await deleteShipEngineLabelPurchaseLockForReplacement({
    supabase: params.svc,
    orderId: params.orderId,
  })
  if (!lockCleared.ok) {
    return { ok: false, error: lockCleared.error }
  }

  const purchased = await purchaseShipEngineLabelForOrderOnce({
    supabase: params.svc,
    orderId: params.orderId,
    ownerKey: `live_chat_ship_from:${params.orderId}:${Date.now()}`,
    rateId: quoted.cheapest.rate_id,
    packageKey: shipmentId ?? undefined,
  })
  if (!purchased.ok) {
    return { ok: false, error: purchased.error }
  }
  if (purchased.alreadyPurchased) {
    return {
      ok: false,
      error: "Could not buy a replacement label — try again in a moment.",
    }
  }

  let labelPdfUrl: string | null = purchased.result.labelUrl
  let labelStoragePath: string | null = null
  let paperlessQrUrl: string | null = purchased.result.paperlessQrUrl
  let paperlessQrStoragePath: string | null = null

  if (labelPdfUrl) {
    const stored = await downloadAndStoreLabelPdf({
      supabase: params.svc,
      orderId: params.orderId,
      pdfUrl: labelPdfUrl,
    })
    if (stored.ok) {
      labelStoragePath = stored.storagePath
      labelPdfUrl = null
    }
  }
  if (paperlessQrUrl) {
    const storedQr = await downloadAndStorePaperlessQr({
      supabase: params.svc,
      orderId: params.orderId,
      qrUrl: paperlessQrUrl,
    })
    if (storedQr.ok) {
      paperlessQrStoragePath = storedQr.storagePath
      paperlessQrUrl = null
    }
  }

  const attached = await attachOrderShippingLabel({
    supabase: params.svc,
    orderId: params.orderId,
    origin: "auto_reswell_checkout",
    shipmentId,
    orderItemId,
    labelPdfUrl,
    labelStoragePath,
    trackingNumber: purchased.result.trackingNumber,
    trackingCarrier: purchased.result.trackingCarrier,
    shipengineRateId: quoted.cheapest.rate_id,
    paperlessQrUrl,
    paperlessQrStoragePath,
    paperlessInstructions: purchased.result.paperlessInstructions,
    paperlessHandoffCode: purchased.result.paperlessHandoffCode,
    insuranceProvider: purchased.result.insuranceProvider,
    insuredValueAmount: purchased.result.insuredValueAmount,
    insuranceCostAmount: purchased.result.insuranceCostAmount,
    insuranceClaimUrl: purchased.result.insuranceClaimUrl,
    shipengineLabelId: purchased.result.shipengineLabelId,
    shipengineShipmentId: purchased.result.shipengineShipmentId,
    labelCostUsd: purchased.result.costAmount,
    labelCostCurrency: purchased.result.costCurrency,
  })
  if (!attached.ok) {
    return { ok: false, error: attached.error }
  }

  const orderNum = formatOrderNumForCustomer(loaded.order.order_num, loaded.order.id)
  if (params.session.support_case_id) {
    try {
      await insertSupportCaseEvent(params.svc, {
        case_id: params.session.support_case_id,
        event_type: "live_chat_ship_from_label_updated",
        payload: {
          orderId: params.orderId,
          shipFromAddressId: params.shipFromAddressId,
          reason: params.reason,
          reasonNote: params.reasonNote ?? null,
          trackingNumber: purchased.result.trackingNumber,
        },
      })
    } catch (error) {
      console.warn("[liveChatShipFromLabelUpdate] audit skipped", error)
    }
  }

  return {
    ok: true,
    orderNum,
    trackingNumber: purchased.result.trackingNumber,
    message: `Updated the ship-from address and reprinted the label for sale #${orderNum}. New tracking: ${purchased.result.trackingNumber}.`,
  }
}
