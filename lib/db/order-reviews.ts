import type { SupabaseClient } from "@supabase/supabase-js"

export type MarketplaceOrderReviewRow = {
  id: string
  order_id: string | null
  reviewer_id: string
  reviewed_id: string
  listing_id: string | null
  rating: number
  comment: string | null
  created_at: string
}

/** One marketplace review row per reviewer per order (buyer→seller or seller→buyer). */
export async function getMarketplaceReviewByOrderAndReviewer(
  supabase: SupabaseClient,
  orderId: string,
  reviewerId: string,
): Promise<{ data: MarketplaceOrderReviewRow | null; error: Error | null }> {
  const { data, error } = await supabase
    .from("reviews")
    .select("id, order_id, reviewer_id, reviewed_id, listing_id, rating, comment, created_at")
    .eq("order_id", orderId)
    .eq("reviewer_id", reviewerId)
    .maybeSingle()

  if (error) {
    return { data: null, error: new Error(error.message) }
  }
  return { data: data as MarketplaceOrderReviewRow | null, error: null }
}

export async function insertMarketplaceReviewForOrder(
  supabase: SupabaseClient,
  input: {
    order_id: string
    reviewer_id: string
    reviewed_id: string
    listing_id: string
    rating: number
    comment: string | null
  },
): Promise<{ data: Pick<MarketplaceOrderReviewRow, "id" | "created_at"> | null; error: Error | null }> {
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
  return { data: data as Pick<MarketplaceOrderReviewRow, "id" | "created_at">, error: null }
}
