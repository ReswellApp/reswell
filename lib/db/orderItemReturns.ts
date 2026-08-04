import type { SupabaseClient } from "@supabase/supabase-js"
import type { OrderItemReturnStatus } from "@/lib/order-item-return-status"
import type { OrderTrackingDetail } from "@/lib/shipping/order-tracking-detail"

export type OrderItemReturnRow = {
  id: string
  order_id: string
  order_item_id: string | null
  listing_id: string
  created_by: string
  item_price_usd: number | string
  shipping_amount_usd: number | string
  refund_amount_usd: number | string
  seller_clawback_usd: number | string
  status: OrderItemReturnStatus
  label_pdf_url: string | null
  label_storage_path: string | null
  shipengine_label_id: string | null
  shipengine_rate_id: string | null
  label_cost_usd: number | string | null
  label_cost_currency: string | null
  paperless_qr_url: string | null
  paperless_qr_storage_path: string | null
  paperless_instructions: string | null
  paperless_handoff_code: string | null
  tracking_number: string | null
  tracking_carrier: string | null
  tracking_detail: OrderTrackingDetail | null
  carrier_delivered_at: string | null
  stripe_refund_id: string | null
  refunded_at: string | null
  created_at: string
  updated_at: string
}

const RETURN_SELECT =
  "id, order_id, order_item_id, listing_id, created_by, item_price_usd, shipping_amount_usd, refund_amount_usd, seller_clawback_usd, status, label_pdf_url, label_storage_path, shipengine_label_id, shipengine_rate_id, label_cost_usd, label_cost_currency, paperless_qr_url, paperless_qr_storage_path, paperless_instructions, paperless_handoff_code, tracking_number, tracking_carrier, tracking_detail, carrier_delivered_at, stripe_refund_id, refunded_at, created_at, updated_at"

function asReturnRow(data: unknown): OrderItemReturnRow {
  return data as OrderItemReturnRow
}

export async function insertOrderItemReturn(
  supabase: SupabaseClient,
  row: {
    order_id: string
    order_item_id?: string | null
    listing_id: string
    created_by: string
    item_price_usd: number
    shipping_amount_usd: number
    refund_amount_usd: number
    seller_clawback_usd: number
    status?: OrderItemReturnStatus
  },
): Promise<{ data: OrderItemReturnRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("order_item_returns")
    .insert({
      order_id: row.order_id,
      order_item_id: row.order_item_id ?? null,
      listing_id: row.listing_id,
      created_by: row.created_by,
      item_price_usd: row.item_price_usd,
      shipping_amount_usd: row.shipping_amount_usd,
      refund_amount_usd: row.refund_amount_usd,
      seller_clawback_usd: row.seller_clawback_usd,
      status: row.status ?? "authorized",
    })
    .select(RETURN_SELECT)
    .single()

  if (error) {
    const parts = [error.message, error.hint, error.details, error.code].filter(
      (s): s is string => typeof s === "string" && s.trim().length > 0,
    )
    return { data: null, error: new Error(parts.length ? parts.join(" — ") : "Insert failed") }
  }
  return { data: asReturnRow(data), error: null }
}

export async function updateOrderItemReturn(
  supabase: SupabaseClient,
  returnId: string,
  patch: Record<string, unknown>,
): Promise<{ error: Error | null }> {
  const { error } = await supabase
    .from("order_item_returns")
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq("id", returnId)

  if (!error) return { error: null }
  const parts = [error.message, error.hint, error.details, error.code].filter(
    (s): s is string => typeof s === "string" && s.trim().length > 0,
  )
  return { error: new Error(parts.length ? parts.join(" — ") : "Update failed") }
}

export async function getOrderItemReturnById(
  supabase: SupabaseClient,
  returnId: string,
): Promise<OrderItemReturnRow | null> {
  const { data, error } = await supabase
    .from("order_item_returns")
    .select(RETURN_SELECT)
    .eq("id", returnId)
    .maybeSingle()
  if (error || !data) return null
  return asReturnRow(data)
}

export async function listOrderItemReturnsForOrder(
  supabase: SupabaseClient,
  orderId: string,
): Promise<OrderItemReturnRow[]> {
  const { data, error } = await supabase
    .from("order_item_returns")
    .select(RETURN_SELECT)
    .eq("order_id", orderId)
    .order("created_at", { ascending: false })
  if (error || !data) return []
  return (data as unknown[]).map(asReturnRow)
}

export async function findActiveReturnForOrderItem(
  supabase: SupabaseClient,
  params: { orderId: string; orderItemId?: string | null; listingId: string },
): Promise<OrderItemReturnRow | null> {
  if (params.orderItemId) {
    const { data } = await supabase
      .from("order_item_returns")
      .select(RETURN_SELECT)
      .eq("order_item_id", params.orderItemId)
      .neq("status", "cancelled")
      .maybeSingle()
    if (data) return asReturnRow(data)
  }
  const { data } = await supabase
    .from("order_item_returns")
    .select(RETURN_SELECT)
    .eq("order_id", params.orderId)
    .eq("listing_id", params.listingId)
    .neq("status", "cancelled")
    .maybeSingle()
  return data ? asReturnRow(data) : null
}

export function returnHasPaperlessQr(
  row: Pick<OrderItemReturnRow, "paperless_qr_url" | "paperless_qr_storage_path"> | null,
): boolean {
  return Boolean(row?.paperless_qr_url?.trim() || row?.paperless_qr_storage_path?.trim())
}

export function returnHasLabelPdf(
  row: Pick<OrderItemReturnRow, "label_pdf_url" | "label_storage_path"> | null,
): boolean {
  return Boolean(row?.label_pdf_url?.trim() || row?.label_storage_path?.trim())
}
