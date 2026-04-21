import type { SupabaseClient } from "@supabase/supabase-js"

export type SellerReviewRow = {
  id: string
  order_id: string | null
  reviewer_id: string
  reviewed_id: string
  listing_id: string | null
  rating: number
  comment: string | null
  created_at: string
}

export async function getSellerReviewByOrderId(
  supabase: SupabaseClient,
  orderId: string,
): Promise<{ data: SellerReviewRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, order_id, reviewer_id, reviewed_id, listing_id, rating, comment, created_at")
    .eq("order_id", orderId)
    .maybeSingle()

  if (error) {
    return { data: null, error: new Error(error.message) }
  }
  return { data: data as SellerReviewRow | null, error: null }
}

export async function insertSellerReviewForOrder(
  supabase: SupabaseClient,
  input: {
    order_id: string
    reviewer_id: string
    reviewed_id: string
    listing_id: string
    rating: number
    comment: string | null
  },
): Promise<{ data: Pick<SellerReviewRow, "id" | "created_at"> | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("reviews")
    .insert({
      order_id: input.order_id,
      reviewer_id: input.reviewer_id,
      reviewed_id: input.reviewed_id,
      listing_id: input.listing_id,
      rating: input.rating,
      comment: input.comment,
    })
    .select("id, created_at")
    .single()

  if (error) {
    return { data: null, error: new Error(error.message) }
  }
  return { data: data as Pick<SellerReviewRow, "id" | "created_at">, error: null }
}
