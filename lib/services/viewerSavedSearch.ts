import { fetchBoardSavedSearchesForUser } from "@/lib/db/savedSearches"
import {
  findSavedSearchForBrand,
  findSavedSearchForModel,
} from "@/lib/utils/saved-search-alert-kind"
import { BOARD_SAVED_SEARCHES_MAX } from "@/lib/validations/boardSavedSearch"
import type { SupabaseClient } from "@supabase/supabase-js"

export async function viewerSavedSearchIdForModel(
  supabase: SupabaseClient,
  userId: string | null | undefined,
  brandModelId: string,
): Promise<string | null> {
  if (!userId) return null
  const { data } = await fetchBoardSavedSearchesForUser(
    supabase,
    userId,
    BOARD_SAVED_SEARCHES_MAX,
  )
  return findSavedSearchForModel(data, brandModelId)?.id ?? null
}

export async function viewerSavedSearchIdForBrand(
  supabase: SupabaseClient,
  userId: string | null | undefined,
  brandId: string,
): Promise<string | null> {
  if (!userId) return null
  const { data } = await fetchBoardSavedSearchesForUser(
    supabase,
    userId,
    BOARD_SAVED_SEARCHES_MAX,
  )
  return findSavedSearchForBrand(data, brandId)?.id ?? null
}
