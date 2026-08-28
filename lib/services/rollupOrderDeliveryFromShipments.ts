import type { SupabaseClient } from "@supabase/supabase-js"
import {
  listOrderShipments,
  type OrderShipmentDeliveryStatus,
  type OrderShipmentRow,
} from "@/lib/db/orderShipments"

export type OrderDeliveryRollup = {
  deliveryStatus: "pending" | "shipped" | "delivered"
  /** Set only when every shipment is carrier-delivered (latest timestamp). */
  carrierDeliveredAt: string | null
  /** Earliest carrier acceptance across shipments, if any. */
  carrierAcceptedAt: string | null
  /** Primary tracking for order denormalized fields (first shipment with TN). */
  primaryTrackingNumber: string | null
  primaryTrackingCarrier: string | null
  allShipmentsDelivered: boolean
  anyShipmentShipped: boolean
}

/**
 * Computes order-level delivery rollup from package shipments.
 * Payout clock must use carrierDeliveredAt only when allShipmentsDelivered.
 */
export function computeOrderDeliveryRollup(shipments: OrderShipmentRow[]): OrderDeliveryRollup {
  if (shipments.length === 0) {
    return {
      deliveryStatus: "pending",
      carrierDeliveredAt: null,
      carrierAcceptedAt: null,
      primaryTrackingNumber: null,
      primaryTrackingCarrier: null,
      allShipmentsDelivered: false,
      anyShipmentShipped: false,
    }
  }

  const statuses = shipments.map((s) => s.delivery_status)
  const allDelivered = statuses.every((s) => s === "delivered")
  const anyShipped = statuses.some((s) => s === "shipped" || s === "delivered")
  const anyPending = statuses.some((s) => s === "pending")

  let deliveryStatus: OrderShipmentDeliveryStatus = "pending"
  if (allDelivered) deliveryStatus = "delivered"
  else if (anyShipped) deliveryStatus = "shipped"
  else if (!anyPending) deliveryStatus = "shipped"

  const deliveredAts = shipments
    .map((s) => s.carrier_delivered_at)
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
  const acceptedAts = shipments
    .map((s) => s.carrier_accepted_at)
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)

  const primary = shipments.find((s) => s.tracking_number?.trim()) ?? shipments[0]!

  return {
    deliveryStatus,
    carrierDeliveredAt: allDelivered && deliveredAts.length > 0
      ? deliveredAts.sort().at(-1)!
      : null,
    carrierAcceptedAt: acceptedAts.length > 0 ? acceptedAts.sort()[0]! : null,
    primaryTrackingNumber: primary.tracking_number?.trim() || null,
    primaryTrackingCarrier: primary.tracking_carrier?.trim() || null,
    allShipmentsDelivered: allDelivered,
    anyShipmentShipped: anyShipped,
  }
}

/**
 * Writes order denormalized delivery fields from shipments.
 * Never sets orders.carrier_delivered_at until every shipment is delivered.
 */
export async function rollupOrderDeliveryFromShipments(
  supabase: SupabaseClient,
  orderId: string,
): Promise<OrderDeliveryRollup> {
  const shipments = await listOrderShipments(supabase, orderId)
  const rollup = computeOrderDeliveryRollup(shipments)

  const { data: orderRow } = await supabase
    .from("orders")
    .select("delivery_status, carrier_delivered_at, tracking_number, tracking_carrier")
    .eq("id", orderId)
    .maybeSingle()

  const current = orderRow as {
    delivery_status?: string
    carrier_delivered_at?: string | null
    tracking_number?: string | null
    tracking_carrier?: string | null
  } | null

  // Do not overwrite pickup statuses.
  if (
    current?.delivery_status === "pickup_ready" ||
    current?.delivery_status === "picked_up"
  ) {
    return rollup
  }

  const patch: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  }

  if (
    current?.delivery_status !== rollup.deliveryStatus &&
    (rollup.deliveryStatus === "pending" ||
      rollup.deliveryStatus === "shipped" ||
      rollup.deliveryStatus === "delivered")
  ) {
    // Never regress delivered → shipped/pending from rollup races.
    if (!(current?.delivery_status === "delivered" && rollup.deliveryStatus !== "delivered")) {
      patch.delivery_status = rollup.deliveryStatus
    }
  }

  if (rollup.carrierDeliveredAt) {
    if (!current?.carrier_delivered_at) {
      patch.carrier_delivered_at = rollup.carrierDeliveredAt
    }
  }

  if (rollup.carrierAcceptedAt) {
    patch.carrier_accepted_at = rollup.carrierAcceptedAt
  }

  if (rollup.primaryTrackingNumber && !current?.tracking_number?.trim()) {
    patch.tracking_number = rollup.primaryTrackingNumber
    patch.tracking_carrier = rollup.primaryTrackingCarrier
  }

  if (Object.keys(patch).length > 1) {
    const { error } = await supabase.from("orders").update(patch).eq("id", orderId)
    if (error) {
      console.error("[rollupOrderDeliveryFromShipments]", orderId, error.message)
    }
  }

  return rollup
}
