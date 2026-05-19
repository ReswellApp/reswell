"use server"

import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import {
  countBoardSavedSearchesForUser,
  deleteBoardSavedSearchForUser,
  fetchBoardSavedSearchesForUser,
  insertBoardSavedSearch,
  type BoardSavedSearchRow,
} from "@/lib/db/boardSavedSearches"
import {
  BOARD_SAVED_SEARCHES_MAX,
  createBoardSavedSearchActionSchema,
  boardSavedCriteriaHasSpecificity,
  deleteBoardSavedSearchActionSchema,
} from "@/lib/validations/boardSavedSearch"

export type BoardSavedSearchListItem = {
  id: string
  label: string | null
  criteria: BoardSavedSearchRow["criteria"]
  emailNotificationsEnabled: boolean
  updatedAt: string
}

function toListItem(row: BoardSavedSearchRow): BoardSavedSearchListItem {
  return {
    id: row.id,
    label: row.label,
    criteria: row.criteria,
    emailNotificationsEnabled: row.email_notifications_enabled,
    updatedAt: row.updated_at,
  }
}

export async function listBoardSavedSearchesAction(): Promise<
  { data: BoardSavedSearchListItem[] } | { error: string }
> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { data: [] }
  }

  const { data, error } = await fetchBoardSavedSearchesForUser(
    supabase,
    user.id,
    BOARD_SAVED_SEARCHES_MAX,
  )

  if (error) {
    return { error: "Could not load saved searches." }
  }

  return { data: data.map(toListItem) }
}

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

  const { count, error: countError } = await countBoardSavedSearchesForUser(supabase, user.id)
  if (countError) {
    return { error: "Could not save search. Try again." as const }
  }
  if (count >= BOARD_SAVED_SEARCHES_MAX) {
    return {
      error: `You can save up to ${BOARD_SAVED_SEARCHES_MAX} searches. Remove one to add another.` as const,
    }
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

export async function deleteBoardSavedSearchAction(raw: unknown) {
  const parsed = deleteBoardSavedSearchActionSchema.safeParse(raw)
  if (!parsed.success) {
    return { error: "Invalid input." as const }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: "Sign in to manage saved searches." as const }
  }

  const { error } = await deleteBoardSavedSearchForUser(supabase, user.id, parsed.data.id)
  if (error) {
    return { error: "Could not remove saved search." as const }
  }

  revalidatePath("/boards")

  return { success: true as const }
}
