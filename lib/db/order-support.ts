import type { SupabaseClient } from "@supabase/supabase-js"

export type OrderSupportRequestRow = {
  id: string
  order_id: string
  buyer_id: string
  request_type: string
  body: string
  contacted_seller_first: boolean | null
  order_ref: string
  created_at: string
}

export async function insertOrderSupportRequest(
  supabase: SupabaseClient,
  row: {
    order_id: string
    buyer_id: string
    request_type: "help" | "cancel_order" | "refund_help"
    body: string
    contacted_seller_first: boolean | null
    order_ref: string
  },
): Promise<{ data: OrderSupportRequestRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("order_support_requests")
    .insert({
      order_id: row.order_id,
      buyer_id: row.buyer_id,
      request_type: row.request_type,
      body: row.body,
      contacted_seller_first: row.contacted_seller_first,
      order_ref: row.order_ref,
    })
    .select("id, order_id, buyer_id, request_type, body, contacted_seller_first, order_ref, created_at")
    .single()

  if (error) {
    return { data: null, error: new Error(error.message) }
  }
  return { data: data as OrderSupportRequestRow, error: null }
}
