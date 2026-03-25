import type { SupabaseClient } from "@supabase/supabase-js"

/** PostgREST: relation not exposed / not in schema cache (e.g. migration not applied yet). */
export function isBoardModelReviewsUnavailable(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  if (error.code === "PGRST205") return true
  const msg = error.message ?? ""
  return msg.includes("board_model_reviews") && msg.includes("schema cache")
}

export type BoardModelReviewRow = {
  id: string
  rating: number
  comment: string | null
  created_at: string
  reviewer_id: string
  profiles: { display_name: string | null; avatar_url: string | null } | null
}

export async function getBoardModelReviewStats(
  supabase: SupabaseClient,
  brandSlug: string,
  modelSlug: string,
): Promise<{ avgRating: number; reviewCount: number }> {
  const { data, error } = await supabase
    .from("board_model_reviews")
    .select("rating")
    .eq("brand_slug", brandSlug)
    .eq("model_slug", modelSlug)

  if (error || !data?.length) {
    if (error && !isBoardModelReviewsUnavailable(error)) {
      console.error("getBoardModelReviewStats:", error.message)
    }
    return { avgRating: 0, reviewCount: 0 }
  }
  const reviewCount = data.length
  const avgRating = data.reduce((s, r) => s + Number(r.rating), 0) / reviewCount
  return { avgRating, reviewCount }
}

export async function listBoardModelReviews(
  supabase: SupabaseClient,
  brandSlug: string,
  modelSlug: string,
): Promise<BoardModelReviewRow[]> {
  const { data, error } = await supabase
    .from("board_model_reviews")
    .select(
      `
      id,
      rating,
      comment,
      created_at,
      reviewer_id,
      profiles (display_name, avatar_url)
    `,
    )
    .eq("brand_slug", brandSlug)
    .eq("model_slug", modelSlug)
    .order("created_at", { ascending: false })

  if (error) {
    if (!isBoardModelReviewsUnavailable(error)) {
      console.error("listBoardModelReviews:", error.message)
    }
    return []
  }
  if (!data) {
    return []
  }
  return data as BoardModelReviewRow[]
}
