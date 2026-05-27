"use server"

import { createClient } from "@/lib/supabase/server"
import {
  searchBoardTalkReviewBrandsSuggest,
  searchBoardTalkReviewModelsForBrand,
  searchBoardTalkReviewsCatalogSuggest,
  type BoardTalkReviewsBrandSuggestRow,
  type BoardTalkReviewsModelSuggestRow,
  type BoardTalkReviewsSearchSuggestResult,
} from "@/lib/services/boardTalkReviewsSearch"

export async function searchBoardTalkReviewsCatalogSuggestAction(
  qRaw: string,
): Promise<BoardTalkReviewsSearchSuggestResult> {
  const supabase = await createClient()
  return searchBoardTalkReviewsCatalogSuggest(supabase, qRaw)
}

export async function searchBoardTalkReviewBrandsAction(
  qRaw: string,
): Promise<BoardTalkReviewsBrandSuggestRow[]> {
  const supabase = await createClient()
  return searchBoardTalkReviewBrandsSuggest(supabase, qRaw)
}

export async function searchBoardTalkReviewModelsForBrandAction(
  brandSlug: string,
  qRaw: string,
): Promise<BoardTalkReviewsModelSuggestRow[]> {
  const supabase = await createClient()
  return searchBoardTalkReviewModelsForBrand(supabase, brandSlug, qRaw)
}
