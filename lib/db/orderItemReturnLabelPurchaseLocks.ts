import type { SupabaseClient } from "@supabase/supabase-js"

export type OrderItemReturnLabelPurchaseLockRow = {
  order_item_return_id: string
  owner_key: string
  status: "pending" | "purchased" | "failed"
  shipengine_rate_id: string | null
  tracking_number: string | null
  tracking_carrier: string | null
  label_pdf_url: string | null
  created_at: string
  updated_at: string
}

export async function getOrderItemReturnLabelPurchaseLock(
  supabase: SupabaseClient,
  returnId: string,
): Promise<OrderItemReturnLabelPurchaseLockRow | null> {
  const { data } = await supabase
    .from("order_item_return_label_purchase_locks")
    .select(
      "order_item_return_id, owner_key, status, shipengine_rate_id, tracking_number, tracking_carrier, label_pdf_url, created_at, updated_at",
    )
    .eq("order_item_return_id", returnId)
    .maybeSingle()
  return (data as OrderItemReturnLabelPurchaseLockRow | null) ?? null
}

export async function insertOrderItemReturnLabelPurchaseLock(params: {
  supabase: SupabaseClient
  returnId: string
  ownerKey: string
  rateId: string
}): Promise<{ ok: true } | { ok: false; conflict: boolean; error: string }> {
  const { error } = await params.supabase.from("order_item_return_label_purchase_locks").insert({
    order_item_return_id: params.returnId,
    owner_key: params.ownerKey,
    status: "pending",
    shipengine_rate_id: params.rateId,
  })
  if (!error) return { ok: true }
  const conflict = error.code === "23505"
  return {
    ok: false,
    conflict,
    error: error.message || "Failed to claim return label purchase lock",
  }
}

export async function markOrderItemReturnLabelPurchaseLockPurchased(params: {
  supabase: SupabaseClient
  returnId: string
  ownerKey: string
  trackingNumber: string | null
  trackingCarrier: string | null
  labelPdfUrl: string | null
  rateId?: string | null
}): Promise<void> {
  await params.supabase
    .from("order_item_return_label_purchase_locks")
    .update({
      status: "purchased",
      tracking_number: params.trackingNumber,
      tracking_carrier: params.trackingCarrier,
      label_pdf_url: params.labelPdfUrl,
      shipengine_rate_id: params.rateId ?? undefined,
      updated_at: new Date().toISOString(),
    })
    .eq("order_item_return_id", params.returnId)
    .eq("owner_key", params.ownerKey)
}

export async function markOrderItemReturnLabelPurchaseLockFailed(params: {
  supabase: SupabaseClient
  returnId: string
  ownerKey: string
}): Promise<void> {
  await params.supabase
    .from("order_item_return_label_purchase_locks")
    .update({
      status: "failed",
      updated_at: new Date().toISOString(),
    })
    .eq("order_item_return_id", params.returnId)
    .eq("owner_key", params.ownerKey)
}

export async function reclaimFailedOrderItemReturnLabelPurchaseLock(params: {
  supabase: SupabaseClient
  returnId: string
  ownerKey: string
  rateId: string
}): Promise<boolean> {
  const { data, error } = await params.supabase
    .from("order_item_return_label_purchase_locks")
    .update({
      owner_key: params.ownerKey,
      status: "pending",
      shipengine_rate_id: params.rateId,
      updated_at: new Date().toISOString(),
    })
    .eq("order_item_return_id", params.returnId)
    .eq("status", "failed")
    .select("order_item_return_id")
    .maybeSingle()
  return !error && Boolean(data)
}
