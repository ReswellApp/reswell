import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { getBrandBySlug } from "@/lib/brands/server"
import { isBoardModelReviewsUnavailable } from "@/lib/board-model-reviews"

const MAX_COMMENT = 8000

export async function POST(request: Request) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: "Sign in to leave a review" }, { status: 401 })
    }

    const body = await request.json()
    const brand_slug = typeof body.brand_slug === "string" ? body.brand_slug.trim() : ""
    const model_slug = typeof body.model_slug === "string" ? body.model_slug.trim() : ""
    const rating = Number(body.rating)
    const commentRaw = typeof body.comment === "string" ? body.comment.trim() : ""
    const comment = commentRaw.length > 0 ? commentRaw.slice(0, MAX_COMMENT) : null

    if (!brand_slug || !model_slug) {
      return NextResponse.json({ error: "Invalid board" }, { status: 400 })
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return NextResponse.json({ error: "Pick a rating from 1 to 5" }, { status: 400 })
    }

    const brand = await getBrandBySlug(supabase, brand_slug)
    if (!brand) {
      return NextResponse.json({ error: "Unknown brand" }, { status: 404 })
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
        return NextResponse.json(
          { error: "Reviews are not set up on this environment yet. Run the board_model_reviews migration in Supabase." },
          { status: 503 },
        )
      }
      console.error("board_model_reviews upsert:", error)
      return NextResponse.json({ error: "Could not save review" }, { status: 500 })
    }

    return NextResponse.json({ success: true })
  } catch {
    return NextResponse.json({ error: "Could not save review" }, { status: 500 })
  }
}
