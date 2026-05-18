"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { insertBoardSavedSearch } from "@/lib/db/boardSavedSearches"
import {
  createBoardSavedSearchActionSchema,
  boardSavedCriteriaHasSpecificity,
} from "@/lib/validations/boardSavedSearch"

export async function createBoardSavedSearchAction(raw: unknown) {
  const parsed = createBoardSavedSearchActionSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: "Invalid input." as const }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Sign in to save a search." as const }
  }

  const criteria = parsed.data.criteria

  if (!boardSavedCriteriaHasSpecificity(criteria)) {
    return { error: "Choose at least one filter before saving." as const }
  }

  const { data, error } = await insertBoardSavedSearch(supabase, user.id, {
    criteria,
    email_notifications_enabled: parsed.data.emailNotificationsEnabled,
    label: parsed.data.label,
  })

  if (error || !data) {
    return { error: "Could not save search. Try again." as const }
  }

  revalidatePath("/boards")

  return {
    success: true as const,
    id: data.id,
    emailNotificationsEnabled: data.email_notifications_enabled,
  }
}
