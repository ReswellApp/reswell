import type { SupabaseClient } from "@supabase/supabase-js"
import type { ShippingPackagingMode } from "@/lib/shipping/packaging-mode"
import { normalizeTrackingNumberForCarrier } from "@/lib/shipping/normalize-tracking-number"

export type OrderShipmentPackagingKind = "together" | "separate_item"

export type OrderShipmentDeliveryStatus = "pending" | "shipped" | "delivered"

export type OrderShipmentRow = {
  id: string
  order_id: string
  sort_order: number
  packaging_kind: OrderShipmentPackagingKind
  delivery_status: OrderShipmentDeliveryStatus
  tracking_number: string | null
  tracking_carrier: string | null
  tracking_detail: unknown
  carrier_accepted_at: string | null
  carrier_delivered_at: string | null
  shipengine_rate_id: string | null
  created_at: string
  updated_at: string
}

export type OrderShipmentWithItems = OrderShipmentRow & {
  order_item_ids: string[]
  listing_ids: string[]
}

const SHIPMENT_SELECT =
  "id, order_id, sort_order, packaging_kind, delivery_status, tracking_number, tracking_carrier, tracking_detail, carrier_accepted_at, carrier_delivered_at, shipengine_rate_id, created_at, updated_at"

function asShipmentRow(data: unknown): OrderShipmentRow | null {
  if (data == null || typeof data !== "object" || Array.isArray(data)) return null
  const r = data as Record<string, unknown>
  const id = typeof r.id === "string" ? r.id : null
  const orderId = typeof r.order_id === "string" ? r.order_id : null
  const packagingKind = r.packaging_kind
  const deliveryStatus = r.delivery_status
  if (!id || !orderId) return null
  if (packagingKind !== "together" && packagingKind !== "separate_item") return null
  if (
    deliveryStatus !== "pending" &&
    deliveryStatus !== "shipped" &&
    deliveryStatus !== "delivered"
  ) {
    return null
  }
  return {
    id,
    order_id: orderId,
    sort_order: typeof r.sort_order === "number" ? r.sort_order : 0,
    packaging_kind: packagingKind,
    delivery_status: deliveryStatus,
    tracking_number: typeof r.tracking_number === "string" ? r.tracking_number : null,
    tracking_carrier: typeof r.tracking_carrier === "string" ? r.tracking_carrier : null,
    tracking_detail: r.tracking_detail ?? null,
    carrier_accepted_at: typeof r.carrier_accepted_at === "string" ? r.carrier_accepted_at : null,
    carrier_delivered_at:
      typeof r.carrier_delivered_at === "string" ? r.carrier_delivered_at : null,
    shipengine_rate_id: typeof r.shipengine_rate_id === "string" ? r.shipengine_rate_id : null,
    created_at: typeof r.created_at === "string" ? r.created_at : "",
    updated_at: typeof r.updated_at === "string" ? r.updated_at : "",
  }
}

export async function listOrderShipments(
  supabase: SupabaseClient,
  orderId: string,
): Promise<OrderShipmentRow[]> {
  const { data, error } = await supabase
    .from("order_shipments")
    .select(SHIPMENT_SELECT)
    .eq("order_id", orderId)
    .order("sort_order", { ascending: true })

  if (error) {
    console.error("[orderShipments] list:", error.message)
    return []
  }
  return (data ?? []).map(asShipmentRow).filter((r): r is OrderShipmentRow => r != null)
}

export async function listOrderShipmentsWithItems(
  supabase: SupabaseClient,
  orderId: string,
): Promise<OrderShipmentWithItems[]> {
  const shipments = await listOrderShipments(supabase, orderId)
  if (shipments.length === 0) return []

  const shipmentIds = shipments.map((s) => s.id)
  const { data: linkRows, error: linkErr } = await supabase
    .from("order_shipment_items")
    .select("shipment_id, order_item_id, order_items ( listing_id )")
    .in("shipment_id", shipmentIds)

  if (linkErr) {
    console.error("[orderShipments] list items:", linkErr.message)
    return shipments.map((s) => ({ ...s, order_item_ids: [], listing_ids: [] }))
  }

  const byShipment = new Map<string, { orderItemIds: string[]; listingIds: string[] }>()
  for (const raw of linkRows ?? []) {
    const row = raw as {
      shipment_id?: string
      order_item_id?: string
      order_items?: { listing_id?: string } | { listing_id?: string }[] | null
    }
    const shipmentId = row.shipment_id?.trim()
    const orderItemId = row.order_item_id?.trim()
    if (!shipmentId || !orderItemId) continue
    const listingRaw = Array.isArray(row.order_items) ? row.order_items[0] : row.order_items
    const listingId =
      listingRaw && typeof listingRaw.listing_id === "string" ? listingRaw.listing_id : null
    const bucket = byShipment.get(shipmentId) ?? { orderItemIds: [], listingIds: [] }
    bucket.orderItemIds.push(orderItemId)
    if (listingId) bucket.listingIds.push(listingId)
    byShipment.set(shipmentId, bucket)
  }

  return shipments.map((s) => {
    const bucket = byShipment.get(s.id)
    return {
      ...s,
      order_item_ids: bucket?.orderItemIds ?? [],
      listing_ids: bucket?.listingIds ?? [],
    }
  })
}

export async function getOrderShipmentById(
  supabase: SupabaseClient,
  shipmentId: string,
): Promise<OrderShipmentRow | null> {
  const { data, error } = await supabase
    .from("order_shipments")
    .select(SHIPMENT_SELECT)
    .eq("id", shipmentId)
    .maybeSingle()

  if (error) {
    console.error("[orderShipments] get:", error.message)
    return null
  }
  return asShipmentRow(data)
}

export async function insertOrderShipmentsForOrder(params: {
  supabase: SupabaseClient
  orderId: string
  packagingMode: ShippingPackagingMode
  /** Ordered lines: id + listing_id (+ optional checkout rate id for Reswell separate). */
  lines: Array<{
    orderItemId: string
    listingId: string
    shipengineRateId?: string | null
  }>
}): Promise<{ ok: true; shipments: OrderShipmentRow[] } | { ok: false; error: string }> {
  const { supabase, orderId, packagingMode, lines } = params
  if (lines.length === 0) {
    return { ok: false, error: "No order lines to create shipments for" }
  }

  const existing = await listOrderShipments(supabase, orderId)
  if (existing.length > 0) {
    return { ok: true, shipments: existing }
  }

  const now = new Date().toISOString()

  if (packagingMode === "together" || lines.length === 1) {
    const rateId = lines.find((l) => l.shipengineRateId?.trim())?.shipengineRateId?.trim() || null
    const { data: shipRow, error: shipErr } = await supabase
      .from("order_shipments")
      .insert({
        order_id: orderId,
        sort_order: 0,
        packaging_kind: "together",
        delivery_status: "pending",
        shipengine_rate_id: rateId,
        created_at: now,
        updated_at: now,
      })
      .select(SHIPMENT_SELECT)
      .single()

    if (shipErr || !shipRow) {
      console.error("[orderShipments] insert together:", shipErr?.message)
      return { ok: false, error: shipErr?.message || "Could not create shipment" }
    }

    const shipment = asShipmentRow(shipRow)
    if (!shipment) {
      return { ok: false, error: "Could not create shipment" }
    }

    const { error: linkErr } = await supabase.from("order_shipment_items").insert(
      lines.map((l) => ({
        shipment_id: shipment.id,
        order_item_id: l.orderItemId,
      })),
    )
    if (linkErr) {
      console.error("[orderShipments] link together items:", linkErr.message)
      return { ok: false, error: linkErr.message || "Could not link shipment items" }
    }

    return { ok: true, shipments: [shipment] }
  }

  const inserted: OrderShipmentRow[] = []
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    const { data: shipRow, error: shipErr } = await supabase
      .from("order_shipments")
      .insert({
        order_id: orderId,
        sort_order: i,
        packaging_kind: "separate_item",
        delivery_status: "pending",
        shipengine_rate_id: line.shipengineRateId?.trim() || null,
        created_at: now,
        updated_at: now,
      })
      .select(SHIPMENT_SELECT)
      .single()

    if (shipErr || !shipRow) {
      console.error("[orderShipments] insert separate:", shipErr?.message)
      return { ok: false, error: shipErr?.message || "Could not create shipments" }
    }
    const shipment = asShipmentRow(shipRow)
    if (!shipment) {
      return { ok: false, error: "Could not create shipments" }
    }

    const { error: linkErr } = await supabase.from("order_shipment_items").insert({
      shipment_id: shipment.id,
      order_item_id: line.orderItemId,
    })
    if (linkErr) {
      console.error("[orderShipments] link separate item:", linkErr.message)
      return { ok: false, error: linkErr.message || "Could not link shipment items" }
    }
    inserted.push(shipment)
  }

  return { ok: true, shipments: inserted }
}

export async function updateOrderShipmentTracking(params: {
  supabase: SupabaseClient
  shipmentId: string
  trackingNumber: string | null
  trackingCarrier: string | null
  /** Only set order tracking fields when currently empty (first write). */
  setIfEmpty?: boolean
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const track = params.trackingNumber?.trim() || null
  const carrier = params.trackingCarrier?.trim() || null
  const now = new Date().toISOString()

  if (params.setIfEmpty) {
    const { data: current } = await params.supabase
      .from("order_shipments")
      .select("tracking_number")
      .eq("id", params.shipmentId)
      .maybeSingle()
    const existing =
      typeof (current as { tracking_number?: string | null } | null)?.tracking_number === "string"
        ? (current as { tracking_number: string }).tracking_number.trim()
        : ""
    if (existing) {
      const { error } = await params.supabase
        .from("order_shipments")
        .update({ updated_at: now })
        .eq("id", params.shipmentId)
      if (error) return { ok: false, error: error.message }
      return { ok: true }
    }
  }

  const { error } = await params.supabase
    .from("order_shipments")
    .update({
      tracking_number: track,
      tracking_carrier: carrier,
      updated_at: now,
    })
    .eq("id", params.shipmentId)

  if (error) {
    console.error("[orderShipments] update tracking:", error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

export async function updateOrderShipmentCarrierFields(params: {
  supabase: SupabaseClient
  shipmentId: string
  patch: Record<string, unknown>
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const { error } = await params.supabase
    .from("order_shipments")
    .update({
      ...params.patch,
      updated_at: new Date().toISOString(),
    })
    .eq("id", params.shipmentId)

  if (error) {
    console.error("[orderShipments] update carrier:", error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

/**
 * Resolves shipments that match a carrier tracking number (labels + shipment TN).
 */
export async function findShipmentIdsByTrackingNumber(
  supabase: SupabaseClient,
  trackingNumberRaw: string,
): Promise<{ shipmentIds: string[]; orderIds: string[]; error?: string }> {
  const trimmed = trackingNumberRaw.trim()
  const normalized = normalizeTrackingNumberForCarrier(trimmed)
  if (!normalized) {
    return { shipmentIds: [], orderIds: [] }
  }

  const variants = [...new Set([normalized, trimmed].filter(Boolean))]
  const shipmentIds = new Set<string>()
  const orderIds = new Set<string>()

  const { data: shipRows, error: shipErr } = await supabase
    .from("order_shipments")
    .select("id, order_id")
    .in("tracking_number", variants)

  if (shipErr) {
    console.error("[findShipmentIdsByTrackingNumber] shipments:", shipErr.message)
    return { shipmentIds: [], orderIds: [], error: "Database lookup failed" }
  }
  for (const row of shipRows ?? []) {
    const r = row as { id: string; order_id: string }
    shipmentIds.add(r.id)
    orderIds.add(r.order_id)
  }

  if (shipmentIds.size === 0) {
    const { data: labelRows, error: labelErr } = await supabase
      .from("order_shipping_labels")
      .select("shipment_id, order_id")
      .in("tracking_number", variants)
      .limit(20)

    if (labelErr) {
      console.error("[findShipmentIdsByTrackingNumber] labels:", labelErr.message)
    } else {
      for (const row of labelRows ?? []) {
        const r = row as { shipment_id?: string | null; order_id?: string }
        if (r.shipment_id) shipmentIds.add(r.shipment_id)
        if (r.order_id) orderIds.add(r.order_id)
      }
    }
  }

  return { shipmentIds: [...shipmentIds], orderIds: [...orderIds] }
}
