"use server"

import { after } from "next/server"
import { revalidatePath } from "next/cache"
import { createClient } from "@/lib/supabase/server"
import { trackKlaviyoSavedSearch } from "@/lib/klaviyo/track-saved-search"
import { newestListingForSavedSearch } from "@/lib/services/newestSavedSearchListing"
import { getDb } from "@/lib/supabase/db"
import {
  countBoardSavedSearchesForUser,
  deleteBoardSavedSearchForUser,
  fetchBoardSavedSearchesForUser,
  insertBoardSavedSearch,
  type BoardSavedSearchRow,
} from "@/lib/db/savedSearches"
import { savedSearchMatchesCriteria } from "@/lib/utils/saved-search-criteria-equal"
import {
  BOARD_SAVED_SEARCHES_MAX,
  createBoardSavedSearchActionSchema,
  boardSavedCriteriaCanSaveFromEmptyState,
  deleteBoardSavedSearchActionSchema,
} from "@/lib/validations/boardSavedSearch"

export type BoardSavedSearchListItem = {
  id: string
  label: string | null
  criteria: BoardSavedSearchRow["criteria"]
  section: string | null
  categoryId: string | null
  emailNotificationsEnabled: boolean
  updatedAt: string
}

function toListItem(row: BoardSavedSearchRow): BoardSavedSearchListItem {
  return {
    id: row.id,
    label: row.label,
    criteria: row.criteria,
    section: row.section,
    categoryId: row.category_id,
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

  // Empty-state category saves (e.g. bare `/fins`) are allowed; sidebar still
  // requires filters via client-side `boardSavedCriteriaHasSpecificity`.
  if (!boardSavedCriteriaCanSaveFromEmptyState(criteria)) {
    return { error: "Choose at least one filter before saving." as const }
  }

  const existing = await fetchBoardSavedSearchesForUser(
    supabase,
    user.id,
    BOARD_SAVED_SEARCHES_MAX,
  )
  if (!existing.error) {
    const already = existing.data.find((row) =>
      savedSearchMatchesCriteria([row], criteria),
    )
    if (already) {
      return {
        success: true as const,
        id: already.id,
        emailNotificationsEnabled: already.email_notifications_enabled,
        alreadySaved: true as const,
      }
    }
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

  const savedSearchId = data.id
  const savedLabel = data.label
  const emailNotificationsEnabled = data.email_notifications_enabled
  const savedAt = data.created_at

  after(() => {
    void (async () => {
      const hero = await newestListingForSavedSearch(
        getDb({ consistency: "eventual", purpose: "catalog" }),
        criteria,
      )
      await trackKlaviyoSavedSearch({
        userId: user.id,
        email: user.email,
        savedSearchId,
        criteria,
        label: savedLabel,
        emailNotificationsEnabled,
        savedAt,
        hero,
      })
    })().catch((err) => {
      console.error("[saved_search] Klaviyo Saved Search event failed:", err)
    })
  })

  revalidatePath("/board-finder")
  revalidatePath("/boards")
  revalidatePath("/fins")
  revalidatePath("/wetsuits")
  revalidatePath("/magazines")
  revalidatePath("/boardbags")
  revalidatePath("/surfpacks")
  revalidatePath("/leashes")
  revalidatePath("/apparel")
  revalidatePath("/accessories")

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

  revalidatePath("/board-finder")
  revalidatePath("/boards")
  revalidatePath("/fins")
  revalidatePath("/wetsuits")
  revalidatePath("/magazines")
  revalidatePath("/boardbags")
  revalidatePath("/surfpacks")
  revalidatePath("/leashes")
  revalidatePath("/apparel")
  revalidatePath("/accessories")

  return { success: true as const }
}
