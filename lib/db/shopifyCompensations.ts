import type { SupabaseClient } from "@supabase/supabase-js"

export type ShopifyInventoryCompensationStatus =
  | "pending"
  | "refunding"
  | "refunded"
  | "failed"

export interface ShopifyInventoryCompensationRow {
  order_id: string
  payment_intent_id: string
  status: ShopifyInventoryCompensationStatus
  stripe_refund_id: string | null
  last_error: string | null
}

export async function dbGetShopifyInventoryCompensation(
  supabase: SupabaseClient,
  orderId: string,
): Promise<ShopifyInventoryCompensationRow | null> {
  const { data, error } = await supabase
    .from("shopify_inventory_compensations")
    .select(
      "order_id, payment_intent_id, status, stripe_refund_id, last_error",
    )
    .eq("order_id", orderId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return (
    (data as unknown as ShopifyInventoryCompensationRow | null) ?? null
  )
}

export async function dbBeginShopifyInventoryCompensation(
  supabase: SupabaseClient,
  orderId: string,
  paymentIntentId: string,
): Promise<void> {
  const { error } = await supabase.rpc("begin_shopify_inventory_compensation", {
    p_order_id: orderId,
    p_payment_intent_id: paymentIntentId,
  })
  if (error) throw new Error(error.message)
}

export async function dbUpdateShopifyInventoryCompensation(
  supabase: SupabaseClient,
  orderId: string,
  input: {
    status: ShopifyInventoryCompensationStatus
    stripeRefundId?: string | null
    error?: string | null
  },
): Promise<void> {
  const { error } = await supabase
    .from("shopify_inventory_compensations")
    .update({
      status: input.status,
      ...(input.stripeRefundId === undefined
        ? {}
        : { stripe_refund_id: input.stripeRefundId }),
      last_error: input.error?.slice(0, 1000) ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("order_id", orderId)
  if (error) throw new Error(error.message)
}

export async function dbMarkShopifyCompensatedOrderRefunded(
  supabase: SupabaseClient,
  orderId: string,
): Promise<void> {
  const now = new Date().toISOString()
  const { error } = await supabase
    .from("orders")
    .update({
      status: "refunded",
      refunded_at: now,
      updated_at: now,
    })
    .eq("id", orderId)
  if (error) throw new Error(error.message)
}

export async function dbGetShopifyCompensationPaymentIntent(
  supabase: SupabaseClient,
  orderId: string,
): Promise<string | null> {
  const { data, error } = await supabase
    .from("orders")
    .select("stripe_checkout_session_id, payment_method")
    .eq("id", orderId)
    .maybeSingle()
  if (error) throw new Error(error.message)
  if (data?.payment_method !== "stripe") return null
  return data.stripe_checkout_session_id?.trim() || null
}
