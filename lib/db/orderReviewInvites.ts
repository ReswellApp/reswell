import type { SupabaseClient } from "@supabase/supabase-js"
import type { OrderReviewInviteRow } from "@/lib/types/order-review-invite"
import { generateOrderReviewInviteToken } from "@/lib/utils/order-review-invite-token"

const INVITE_SELECT =
  "id, order_id, token, buyer_id, seller_id, listing_id, post_purchase_sent_at, fulfillment_reminder_sent_at, created_at"

export async function getOrderReviewInviteByOrderId(
  supabase: SupabaseClient,
  orderId: string,
): Promise<{ data: OrderReviewInviteRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("order_review_invites")
    .select(INVITE_SELECT)
    .eq("order_id", orderId)
    .maybeSingle()

  if (error) {
    return { data: null, error: new Error(error.message) }
  }
  return { data: (data as OrderReviewInviteRow | null) ?? null, error: null }
}

export async function getOrderReviewInviteByToken(
  supabase: SupabaseClient,
  token: string,
): Promise<{ data: OrderReviewInviteRow | null; error: Error | null }> {
  const trimmed = token.trim()
  if (!trimmed) {
    return { data: null, error: null }
  }

  const { data, error } = await supabase
    .from("order_review_invites")
    .select(INVITE_SELECT)
    .eq("token", trimmed)
    .maybeSingle()

  if (error) {
    return { data: null, error: new Error(error.message) }
  }
  return { data: (data as OrderReviewInviteRow | null) ?? null, error: null }
}

type EnsureInviteInput = {
  orderId: string
  buyerId: string
  sellerId: string
  listingId: string | null
}

export async function ensureOrderReviewInviteRow(
  supabase: SupabaseClient,
  input: EnsureInviteInput,
): Promise<{ data: OrderReviewInviteRow | null; error: Error | null }> {
  const existing = await getOrderReviewInviteByOrderId(supabase, input.orderId)
  if (existing.error) return existing
  if (existing.data) return { data: existing.data, error: null }

  const token = generateOrderReviewInviteToken()
  const { data, error } = await supabase
    .from("order_review_invites")
    .insert({
      order_id: input.orderId,
      token,
      buyer_id: input.buyerId,
      seller_id: input.sellerId,
      listing_id: input.listingId,
    })
    .select(INVITE_SELECT)
    .single()

  if (error) {
    if (error.code === "23505") {
      return getOrderReviewInviteByOrderId(supabase, input.orderId)
    }
    return { data: null, error: new Error(error.message) }
  }

  return { data: data as OrderReviewInviteRow, error: null }
}

export async function markOrderReviewInvitePhaseSent(
  supabase: SupabaseClient,
  orderId: string,
  phase: "post_purchase" | "fulfillment",
  sentAt: string,
): Promise<{ error: Error | null }> {
  const patch =
    phase === "post_purchase"
      ? { post_purchase_sent_at: sentAt }
      : { fulfillment_reminder_sent_at: sentAt }

  const { error } = await supabase
    .from("order_review_invites")
    .update(patch)
    .eq("order_id", orderId)
    .is(phase === "post_purchase" ? "post_purchase_sent_at" : "fulfillment_reminder_sent_at", null)

  if (error) {
    return { error: new Error(error.message) }
  }
  return { error: null }
}
