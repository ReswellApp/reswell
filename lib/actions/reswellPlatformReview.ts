"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { submitReswellPlatformReviewService } from "@/lib/services/reswellPlatformReview"
import { reswellPlatformReviewSchema } from "@/lib/validations/reswellPlatformReview"

export async function submitReswellPlatformReviewAction(raw: unknown) {
  const parsed = reswellPlatformReviewSchema.safeParse(raw)
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0]?.message
    return { error: firstIssue ?? "Invalid input." as const }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Sign in to rate Reswell." as const }
  }

  const result = await submitReswellPlatformReviewService(supabase, user.id, parsed.data)
  if (!result.ok) {
    return { error: result.error as string }
  }

  revalidatePath("/ratereswell")
  revalidatePath("/reswellreviews")

  return { success: true as const, isUpdate: result.isUpdate }
}
