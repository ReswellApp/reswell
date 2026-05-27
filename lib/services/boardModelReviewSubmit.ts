import type { SupabaseClient } from "@supabase/supabase-js"
import { getBrandBySlug } from "@/lib/brands/server"
import { listBrandModelsForPublicCatalogByBrandId } from "@/lib/db/brand-models"
import { isBoardModelReviewsUnavailable } from "@/lib/board-model-reviews"
import { slugify } from "@/lib/slugify"
import {
  BOARD_REVIEW_ATTACHMENTS_BUCKET,
  boardReviewAttachmentInputSchema,
  boardReviewAttachmentMetadataSchema,
  type BoardReviewImageAttachment,
} from "@/lib/validations/board-review-attachment"
import { createServiceRoleClient } from "@/lib/supabase/server"

const MAX_COMMENT = 8000

export type SubmitBoardModelReviewInput = {
  brand_slug: string
  model_slug: string
  rating: number
  comment?: string
  attachment?: Omit<BoardReviewImageAttachment, "bucket">
}

export type SubmitBoardModelReviewResult =
  | { success: true }
  | { error: string }

function attachmentPathBelongsToReviewer(path: string, reviewerId: string): boolean {
  const prefix = `${reviewerId}/`
  return path.startsWith(prefix) && path.length > prefix.length
}

export async function submitBoardModelReviewService(
  supabase: SupabaseClient,
  userId: string,
  input: SubmitBoardModelReviewInput,
): Promise<SubmitBoardModelReviewResult> {
  const brand_slug = typeof input.brand_slug === "string" ? input.brand_slug.trim() : ""
  const model_slug = typeof input.model_slug === "string" ? input.model_slug.trim() : ""
  const rating = Number(input.rating)
  const commentRaw = typeof input.comment === "string" ? input.comment.trim() : ""
  const comment = commentRaw.length > 0 ? commentRaw.slice(0, MAX_COMMENT) : null

  if (!brand_slug || !model_slug) {
    return { error: "Pick a brand and model" }
  }

  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return { error: "Pick a rating from 1 to 5" }
  }

  const brand = await getBrandBySlug(supabase, brand_slug)
  if (!brand) {
    return { error: "Unknown brand" }
  }

  const models = await listBrandModelsForPublicCatalogByBrandId(supabase, brand.id)
  const modelMatch = models.find((model) => slugify(model.name) === model_slug)
  if (!modelMatch) {
    return { error: "Unknown model for this brand" }
  }

  let metadata: { attachment: BoardReviewImageAttachment & { bucket: string } } | null = null

  if (input.attachment) {
    const attachmentParsed = boardReviewAttachmentInputSchema.safeParse(input.attachment)
    if (!attachmentParsed.success) {
      return { error: "Invalid photo attachment" }
    }

    const attachment = { ...attachmentParsed.data, bucket: BOARD_REVIEW_ATTACHMENTS_BUCKET }
    if (!attachmentPathBelongsToReviewer(attachment.path, userId)) {
      return { error: "Invalid photo path" }
    }

    const service = createServiceRoleClient()
    const objectName = attachment.path.slice(userId.length + 1)
    const { data: listed, error: listErr } = await service.storage
      .from(BOARD_REVIEW_ATTACHMENTS_BUCKET)
      .list(userId, { search: objectName, limit: 1 })

    if (listErr || !listed?.some((obj) => obj.name === objectName)) {
      return { error: "Photo upload not found — try adding the photo again" }
    }

    const metaParsed = boardReviewAttachmentMetadataSchema.safeParse({ attachment })
    if (!metaParsed.success) {
      return { error: "Invalid photo attachment" }
    }
    metadata = metaParsed.data
  }

  const { error } = await supabase.from("board_model_reviews").upsert(
    {
      brand_slug,
      model_slug,
      reviewer_id: userId,
      rating,
      comment,
      metadata,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "brand_slug,model_slug,reviewer_id" },
  )

  if (error) {
    if (isBoardModelReviewsUnavailable(error)) {
      return {
        error:
          "Reviews are not set up on this environment yet. Run the board_model_reviews migration in Supabase.",
      }
    }
    console.error("board_model_reviews upsert:", error)
    return { error: "Could not save review" }
  }

  return { success: true }
}
