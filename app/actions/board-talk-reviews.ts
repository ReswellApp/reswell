"use server"

import { createClient } from "@/lib/supabase/server"
import {
  searchBoardTalkReviewsCatalogSuggest,
  type BoardTalkReviewsSearchSuggestResult,
} from "@/lib/services/boardTalkReviewsSearch"

export async function searchBoardTalkReviewsCatalogSuggestAction(
  qRaw: string,
): Promise<BoardTalkReviewsSearchSuggestResult> {
  const supabase = await createClient()
  return searchBoardTalkReviewsCatalogSuggest(supabase, qRaw)
}
