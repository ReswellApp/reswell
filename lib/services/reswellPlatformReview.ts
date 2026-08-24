import type { SupabaseClient } from "@supabase/supabase-js"
import {
  getReswellPlatformReviewByUserId,
  getReswellReviewAuthorName,
  upsertReswellPlatformReview,
  type ReswellPlatformReviewRow,
} from "@/lib/db/reswellPlatformReviews"
import type {
  ReswellPlatformReviewInput,
  SoldFlowReswellReviewInput,
} from "@/lib/validations/reswellPlatformReview"

type SubmitResult =
  | { ok: true; review: ReswellPlatformReviewRow; isUpdate: boolean }
  | { ok: false; error: string }

export async function submitReswellPlatformReviewService(
  supabase: SupabaseClient,
  userId: string,
  input: ReswellPlatformReviewInput,
): Promise<SubmitResult> {
  const { data: existing } = await getReswellPlatformReviewByUserId(supabase, userId)

  const descriptionBody = input.title?.trim()
    ? `${input.title.trim()}\n\n${input.description}`
    : input.description

  const { data, error } = await upsertReswellPlatformReview(supabase, {
    user_id: userId,
    full_name: input.fullName,
    description: descriptionBody,
    rating: input.rating,
  })

  if (error || !data) {
    console.error("[submitReswellPlatformReview] upsert failed", {
      userId,
      message: error?.message ?? "no row returned",
    })
    return { ok: false, error: "Could not save your review. Please try again." }
  }

  return { ok: true, review: data, isUpdate: !!existing }
}

/** Written text is optional in the sold flow; the table still requires a non-empty description. */
const SOLD_FLOW_STAR_ONLY_REVIEW = "Rated Reswell after selling a listing."

function resolveSoldFlowReviewDescription(
  submitted: string,
  existingDescription?: string | null,
): string {
  const trimmed = submitted.trim()
  if (trimmed.length > 0) return trimmed
  const existing = existingDescription?.trim() ?? ""
  if (existing.length > 0) return existing
  return SOLD_FLOW_STAR_ONLY_REVIEW
}

export async function submitSoldFlowReswellReviewService(
  supabase: SupabaseClient,
  userId: string,
  input: SoldFlowReswellReviewInput,
): Promise<SubmitResult> {
  const fullName = await getReswellReviewAuthorName(supabase, userId)
  const { data: existing } = await getReswellPlatformReviewByUserId(supabase, userId)
  return submitReswellPlatformReviewService(supabase, userId, {
    fullName,
    description: resolveSoldFlowReviewDescription(input.description, existing?.description),
    rating: input.rating,
  })
}
