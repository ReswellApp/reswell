"use server"

import { createClient } from "@/lib/supabase/server"
import { getBrandBySlug } from "@/lib/brands/server"
import { isBoardModelReviewsUnavailable } from "@/lib/board-model-reviews"

const MAX_COMMENT = 8000

export async function submitBoardModelReview(input: {
  brand_slug: string
  model_slug: string
  rating: number
  comment?: string
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Sign in to leave a review" as const }
  }

  const brand_slug = typeof input.brand_slug === "string" ? input.brand_slug.trim() : ""
  const model_slug = typeof input.model_slug === "string" ? input.model_slug.trim() : ""
  const rating = Number(input.rating)
  const commentRaw = typeof input.comment === "string" ? input.comment.trim() : ""
  const comment = commentRaw.length > 0 ? commentRaw.slice(0, MAX_COMMENT) : null

  if (!brand_slug || !model_slug) {
    return { error: "Invalid board" as const }
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "Pick a rating from 1 to 5" as const }
  }

  const brand = await getBrandBySlug(supabase, brand_slug)
  if (!brand) {
    return { error: "Unknown brand" as const }
  }

  const { error } = await supabase.from("board_model_reviews").upsert(
    {
      brand_slug,
      model_slug,
      reviewer_id: user.id,
      rating,
      comment,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "brand_slug,model_slug,reviewer_id" },
  )

  if (error) {
    if (isBoardModelReviewsUnavailable(error)) {
      return {
        error:
          "Reviews are not set up on this environment yet. Run the board_model_reviews migration in Supabase." as const,
      }
    }
    console.error("board_model_reviews upsert:", error)
    return { error: "Could not save review" as const }
  }

  return { success: true as const }
}
