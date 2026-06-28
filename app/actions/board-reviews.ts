"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import {
  submitBoardModelReviewService,
  type SubmitBoardModelReviewInput,
} from "@/lib/services/boardModelReviewSubmit"

export async function submitBoardModelReview(input: SubmitBoardModelReviewInput) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Sign in to leave a review" as const }
  }

  const result = await submitBoardModelReviewService(supabase, user.id, input)

  if ("success" in result && result.success) {
    revalidatePath("/threads/reviews")
    return { success: true as const }
  }

  return { error: "error" in result ? result.error : "Could not save review" }
}
