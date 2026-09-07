import type { SupabaseClient } from "@supabase/supabase-js"
import { isReviewsMetadataColumnMissing } from "@/lib/marketplace-review-photos"

export type MarketplaceOrderReviewRow = {
  id: string
  order_id: string | null
  reviewer_id: string
  reviewed_id: string
  listing_id: string | null
  rating: number
  comment: string | null
  created_at: string
  metadata: unknown
}

export type SellerReviewPreviewRow = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  metadata?: unknown
  reviewer?:
    | { display_name?: string | null }
    | { display_name?: string | null }[]
    | null
}

const ORDER_REVIEW_SELECT =
  "id, order_id, reviewer_id, reviewed_id, listing_id, rating, comment, created_at, metadata"
const ORDER_REVIEW_SELECT_LEGACY =
  "id, order_id, reviewer_id, reviewed_id, listing_id, rating, comment, created_at"

const SELLER_REVIEW_PREVIEW_SELECT =
  "id, rating, comment, created_at, metadata, reviewer:profiles!reviews_reviewer_id_fkey ( display_name )"
const SELLER_REVIEW_PREVIEW_SELECT_LEGACY =
  "id, rating, comment, created_at, reviewer:profiles!reviews_reviewer_id_fkey ( display_name )"

/** One marketplace review row per reviewer per order (buyer→seller or seller→buyer). */
export async function getMarketplaceReviewByOrderAndReviewer(
  supabase: SupabaseClient,
  orderId: string,
  reviewerId: string,
): Promise<{ data: MarketplaceOrderReviewRow | null; error: Error | null }> {
  const run = (select: string) =>
    supabase
      .from("reviews")
      .select(select)
      .eq("order_id", orderId)
      .eq("reviewer_id", reviewerId)
      .maybeSingle()

  let { data, error } = await run(ORDER_REVIEW_SELECT)
  if (error && isReviewsMetadataColumnMissing(error)) {
    ;({ data, error } = await run(ORDER_REVIEW_SELECT_LEGACY))
  }

  if (error) {
    return { data: null, error: new Error(error.message) }
  }
  return { data: (data as MarketplaceOrderReviewRow | null) ?? null, error: null }
}

export async function listSellerReviewPreviews(
  supabase: SupabaseClient,
  sellerId: string,
  limit = 8,
): Promise<{ data: SellerReviewPreviewRow[]; error: Error | null }> {
  const run = (select: string) =>
    supabase
      .from("reviews")
      .select(select)
      .eq("reviewed_id", sellerId)
      .order("created_at", { ascending: false })
      .limit(limit)

  let { data, error } = await run(SELLER_REVIEW_PREVIEW_SELECT)
  if (error && isReviewsMetadataColumnMissing(error)) {
    ;({ data, error } = await run(SELLER_REVIEW_PREVIEW_SELECT_LEGACY))
  }

  if (error) {
    return { data: [], error: new Error(error.message) }
  }
  return { data: (data ?? []) as SellerReviewPreviewRow[], error: null }
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
    metadata: unknown
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
      ...(input.metadata != null ? { metadata: input.metadata } : {}),
    })
    .select("id, created_at")
    .single()

  if (error) {
    return { data: null, error: new Error(error.message) }
  }
  return { data: data as Pick<MarketplaceOrderReviewRow, "id" | "created_at">, error: null }
}
