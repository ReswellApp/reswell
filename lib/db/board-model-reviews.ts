import type { SupabaseClient } from "@supabase/supabase-js"
import { isBoardModelReviewsUnavailable, type BoardModelReviewRow } from "@/lib/board-model-reviews"

export type BoardModelReviewFeedRow = BoardModelReviewRow & {
  brand_slug: string
  model_slug: string
}

export async function fetchRecentBoardModelReviews(
  supabase: SupabaseClient,
  limit: number,
): Promise<BoardModelReviewFeedRow[]> {
  const { data, error } = await supabase
    .from("board_model_reviews")
    .select(
      `
      id,
      brand_slug,
      model_slug,
      rating,
      comment,
      created_at,
      reviewer_id,
      profiles (display_name, avatar_url)
    `,
    )
    .order("created_at", { ascending: false })
    .limit(limit)

  if (error) {
    if (!isBoardModelReviewsUnavailable(error)) {
      console.error("[board-model-reviews] fetchRecentBoardModelReviews:", error.message)
    }
    return []
  }

  return (data ?? []) as BoardModelReviewFeedRow[]
}

export type BrandModelNameRow = {
  brand_id: string
  name: string
}

export async function fetchBrandModelNamesForBrandIds(
  supabase: SupabaseClient,
  brandIds: string[],
): Promise<BrandModelNameRow[]> {
  if (brandIds.length === 0) return []

  const { data, error } = await supabase
    .from("brand_models")
    .select("brand_id, name")
    .in("brand_id", brandIds)

  if (error) {
    console.error("[board-model-reviews] fetchBrandModelNamesForBrandIds:", error.message)
    return []
  }

  return (data ?? []) as BrandModelNameRow[]
}
