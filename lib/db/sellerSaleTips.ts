import type { SupabaseClient } from "@supabase/supabase-js"

export type SellerSaleTipStatus = "pending" | "succeeded" | "canceled" | "failed"

export type SellerSaleTipRow = {
  id: string
  listing_id: string
  seller_user_id: string
  amount_cents: number
  stripe_payment_intent_id: string
  status: SellerSaleTipStatus
  created_at: string
  succeeded_at: string | null
}

export async function insertSellerSaleTip(
  supabase: SupabaseClient,
  row: {
    listingId: string
    sellerUserId: string
    amountCents: number
    stripePaymentIntentId: string
  },
): Promise<SellerSaleTipRow | null> {
  const { data, error } = await supabase
    .from("seller_sale_tips")
    .insert({
      listing_id: row.listingId,
      seller_user_id: row.sellerUserId,
      amount_cents: row.amountCents,
      stripe_payment_intent_id: row.stripePaymentIntentId,
      status: "pending",
    })
    .select(
      "id, listing_id, seller_user_id, amount_cents, stripe_payment_intent_id, status, created_at, succeeded_at",
    )
    .single()

  if (error) {
    console.error("[sellerSaleTips] insert failed", error)
    return null
  }
  return data as SellerSaleTipRow
}

export async function getSellerSaleTipByPaymentIntentId(
  supabase: SupabaseClient,
  paymentIntentId: string,
): Promise<SellerSaleTipRow | null> {
  const { data, error } = await supabase
    .from("seller_sale_tips")
    .select(
      "id, listing_id, seller_user_id, amount_cents, stripe_payment_intent_id, status, created_at, succeeded_at",
    )
    .eq("stripe_payment_intent_id", paymentIntentId)
    .maybeSingle()

  if (error) {
    console.error("[sellerSaleTips] load by payment intent failed", error)
    return null
  }
  return data as SellerSaleTipRow | null
}

export async function markSellerSaleTipSucceeded(
  supabase: SupabaseClient,
  paymentIntentId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("seller_sale_tips")
    .update({
      status: "succeeded",
      succeeded_at: new Date().toISOString(),
    })
    .eq("stripe_payment_intent_id", paymentIntentId)
    .eq("status", "pending")

  if (error) {
    console.error("[sellerSaleTips] mark succeeded failed", error)
    return false
  }
  return true
}
