import { createServiceRoleClient } from "@/lib/supabase/server"
import { getOrderDetailForAdmin } from "@/lib/db/adminOrders"
import {
  dbListIncreasedLabelAdjustmentsForOrder,
  type ShipEngineLabelAdjustmentRow,
} from "@/lib/db/shipengineLabelAdjustments"
import { dbListDisputesForAdjustments } from "@/lib/db/shippingAdjustmentDisputes"
import {
  ADJUSTMENT_DISPUTE_REASON_CODES,
  inferAdjustmentCarrier,
  type AdjustmentDisputeCarrier,
  type AdjustmentDisputeReasonCode,
} from "@/lib/shipping/adjustment-fee"
import {
  buildShipEngineDisputePacket,
  defaultDisputePacketContact,
  type DisputePacketDims,
  type ShipEngineDisputePacket,
} from "@/lib/shipping/shipengine-dispute-packet"
import { resolveShipEngineCarrierCode } from "@/lib/shipping/resolve-carrier-code"

export type AdminShipEngineDisputePacketItem = {
  adjustmentId: string
  amountUsd: number
  trackingNumber: string | null
  carrier: AdjustmentDisputeCarrier
  hasSellerDispute: boolean
  packet: ShipEngineDisputePacket
}

function parseDisputeReasonCode(
  value: string | null | undefined,
): AdjustmentDisputeReasonCode | null {
  if (!value) return null
  return (ADJUSTMENT_DISPUTE_REASON_CODES as readonly string[]).includes(value)
    ? (value as AdjustmentDisputeReasonCode)
    : null
}

function ozToLb(oz: number | null): number | null {
  if (oz == null || !Number.isFinite(oz)) return null
  return Math.round((oz / 16) * 1000) / 1000
}

function carrierFromSources(
  trackingCarrier: string | null | undefined,
  trackingNumber: string | null | undefined,
  actualService: string | null | undefined,
): AdjustmentDisputeCarrier {
  const inferred = inferAdjustmentCarrier(actualService, trackingCarrier, trackingNumber)
  if (inferred) return inferred
  const code = resolveShipEngineCarrierCode(trackingNumber ?? "", trackingCarrier)
  if (code === "ups" || code === "ups_walleted") return "ups"
  if (code === "usps" || code === "stamps_com" || code === "endicia") return "usps"
  if (code === "fedex") return "fedex"
  return "ups"
}

async function loadLabeledDimsForOrder(listingIds: string[]): Promise<DisputePacketDims> {
  const empty: DisputePacketDims = {
    lengthIn: null,
    widthIn: null,
    heightIn: null,
    weightLb: null,
  }
  const ids = [...new Set(listingIds.filter(Boolean))]
  if (ids.length === 0) return empty

  let supabase: ReturnType<typeof createServiceRoleClient>
  try {
    supabase = createServiceRoleClient()
  } catch {
    return empty
  }

  const { data, error } = await supabase
    .from("listings")
    .select(
      "id, shipping_packed_length_in, shipping_packed_width_in, shipping_packed_height_in, shipping_packed_weight_oz",
    )
    .in("id", ids)
  if (error || !data?.length) return empty

  // Prefer the largest packed carton when an order has multiple lines.
  let best = empty
  let bestVolume = -1
  for (const row of data) {
    const lengthIn =
      row.shipping_packed_length_in == null ? null : Number(row.shipping_packed_length_in)
    const widthIn =
      row.shipping_packed_width_in == null ? null : Number(row.shipping_packed_width_in)
    const heightIn =
      row.shipping_packed_height_in == null ? null : Number(row.shipping_packed_height_in)
    const weightLb = ozToLb(
      row.shipping_packed_weight_oz == null ? null : Number(row.shipping_packed_weight_oz),
    )
    const volume =
      (Number.isFinite(lengthIn) ? Number(lengthIn) : 0) *
      (Number.isFinite(widthIn) ? Number(widthIn) : 0) *
      (Number.isFinite(heightIn) ? Number(heightIn) : 0)
    if (volume >= bestVolume) {
      bestVolume = volume
      best = {
        lengthIn: Number.isFinite(lengthIn) ? lengthIn : null,
        widthIn: Number.isFinite(widthIn) ? widthIn : null,
        heightIn: Number.isFinite(heightIn) ? heightIn : null,
        weightLb,
      }
    }
  }
  return best
}

function packetForAdjustment(input: {
  adjustment: ShipEngineLabelAdjustmentRow
  carrier: AdjustmentDisputeCarrier
  orderId: string
  orderDisplayNum: string | null
  listingTitle: string | null
  trackingCarrier: string | null
  labeled: DisputePacketDims
  dispute: {
    reason_code: string
    seller_statement: string
    claimed_length_in: number | null
    claimed_width_in: number | null
    claimed_height_in: number | null
    claimed_weight_lb: number | null
  } | null
  contact: ReturnType<typeof defaultDisputePacketContact>
  today: Date
}): AdminShipEngineDisputePacketItem {
  const claimed: DisputePacketDims = {
    lengthIn: input.dispute?.claimed_length_in ?? null,
    widthIn: input.dispute?.claimed_width_in ?? null,
    heightIn: input.dispute?.claimed_height_in ?? null,
    weightLb: input.dispute?.claimed_weight_lb ?? null,
  }
  const carrierMeasured: DisputePacketDims = {
    lengthIn: input.adjustment.actual_length,
    widthIn: input.adjustment.actual_width,
    heightIn: input.adjustment.actual_height,
    weightLb: input.adjustment.actual_weight,
  }

  const packet = buildShipEngineDisputePacket({
    carrier: input.carrier,
    trackingNumber: input.adjustment.tracking_number,
    trackingCarrier: input.trackingCarrier,
    orderDisplayNum: input.orderDisplayNum,
    orderId: input.orderId,
    listingTitle: input.listingTitle,
    adjustmentAmountUsd: input.adjustment.adjustment_amount_usd,
    adjustmentAt: input.adjustment.adjustment_at,
    adjustmentId: input.adjustment.adjustment_id,
    adjustmentType: input.adjustment.adjustment_type,
    reasonCode: input.adjustment.reason_code,
    carrierMeasured,
    labeled: input.labeled,
    claimed,
    disputeReasonCode: parseDisputeReasonCode(input.dispute?.reason_code),
    sellerStatement: input.dispute?.seller_statement ?? null,
    ...input.contact,
    today: input.today,
  })

  return {
    adjustmentId: input.adjustment.id,
    amountUsd: input.adjustment.adjustment_amount_usd,
    trackingNumber: input.adjustment.tracking_number,
    carrier: input.carrier,
    hasSellerDispute: Boolean(input.dispute),
    packet,
  }
}

export async function getAdminShipEngineDisputePacketsForOrder(
  orderId: string,
): Promise<
  | { ok: true; data: AdminShipEngineDisputePacketItem[] }
  | { ok: false; error: string }
> {
  let service: ReturnType<typeof createServiceRoleClient>
  try {
    service = createServiceRoleClient()
  } catch {
    return { ok: false, error: "Could not load dispute packet" }
  }

  const orderResult = await getOrderDetailForAdmin(service, orderId)
  if (orderResult.error) return { ok: false, error: "Could not load order" }
  if (!orderResult.data) return { ok: false, error: "Order not found" }
  const order = orderResult.data

  const adjustments = await dbListIncreasedLabelAdjustmentsForOrder(service, orderId)
  if (adjustments.error) return { ok: false, error: "Could not load adjustments" }

  const rows = adjustments.data
  if (rows.length === 0) {
    // Still allow filing from tracking alone (loss/damage or adjustment not yet linked).
    const carrier = carrierFromSources(order.tracking_carrier, order.tracking_number, null)
    const contact = defaultDisputePacketContact()
    const labeled = await loadLabeledDimsForOrder([
      order.listing_id,
      ...order.order_items.map((item) => item.listing_id),
    ])
    const emptyAdjustment: ShipEngineLabelAdjustmentRow = {
      id: `order:${orderId}`,
      report_id: "",
      transaction_id: "",
      adjustment_id: null,
      shipment_id: null,
      tracking_number: order.tracking_number,
      adjustment_type: null,
      reason_code: null,
      adjustment_amount_usd: 0,
      adjustment_at: null,
      actual_service: null,
      actual_package: null,
      actual_weight: null,
      actual_length: null,
      actual_width: null,
      actual_height: null,
      order_id: orderId,
      wallet_transaction_id: null,
      wallet_debited_at: null,
      charge_seller_wallet: false,
      created_at: new Date().toISOString(),
    }
    return {
      ok: true,
      data: [
        packetForAdjustment({
          adjustment: emptyAdjustment,
          carrier,
          orderId,
          orderDisplayNum: order.order_num,
          listingTitle: order.listing_title,
          trackingCarrier: order.tracking_carrier,
          labeled,
          dispute: null,
          contact,
          today: new Date(),
        }),
      ],
    }
  }

  const disputes = await dbListDisputesForAdjustments(
    service,
    rows.map((row) => row.id),
  )
  if (disputes.error) {
    console.error("[shipengine dispute packet]", disputes.error.message)
  }
  const disputeByAdjustment = new Map(
    (disputes.data ?? []).map((dispute) => [dispute.adjustment_id, dispute]),
  )

  const labeled = await loadLabeledDimsForOrder([
    order.listing_id,
    ...order.order_items.map((item) => item.listing_id),
  ])
  const contact = defaultDisputePacketContact()
  const today = new Date()

  return {
    ok: true,
    data: rows.map((adjustment) => {
      const dispute = disputeByAdjustment.get(adjustment.id) ?? null
      const carrier =
        dispute?.carrier ??
        carrierFromSources(
          order.tracking_carrier,
          adjustment.tracking_number ?? order.tracking_number,
          adjustment.actual_service,
        )
      return packetForAdjustment({
        adjustment,
        carrier,
        orderId,
        orderDisplayNum: order.order_num,
        listingTitle: order.listing_title,
        trackingCarrier: order.tracking_carrier,
        labeled,
        dispute,
        contact,
        today,
      })
    }),
  }
}
