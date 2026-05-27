import { unstable_cache } from "next/cache"
import {
  boardsBrowseCategoryTypeCacheKey,
  fetchBoardsBrowseCategoryTypePage,
  isBoardsBrowseCategoryTypeView,
  type BoardsBrowseCategoryTypePage,
} from "@/lib/db/boards-browse-listings"
import type { BoardsBrowseSearchParams } from "@/lib/marketplace-slug-metadata"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"

/** Hourly cache for nav category views (`/boards`, `/boards?type=…`). */
export const BOARDS_BROWSE_CACHE_TAG = "boards-browse"
export const BOARDS_BROWSE_REVALIDATE_SECONDS = 60 * 60

export { isBoardsBrowseCategoryTypeView }

async function loadBoardsBrowseCategoryTypePage(
  boardType: string,
  page: number,
): Promise<BoardsBrowseCategoryTypePage> {
  const supabase = createAnonSupabaseClient()
  return fetchBoardsBrowseCategoryTypePage(supabase, { boardType, page })
}

const getCachedBoardsBrowseCategoryTypePage = unstable_cache(
  loadBoardsBrowseCategoryTypePage,
  ["boards-browse-category-type"],
  {
    revalidate: BOARDS_BROWSE_REVALIDATE_SECONDS,
    tags: [BOARDS_BROWSE_CACHE_TAG],
  },
)

export async function getBoardsBrowseCategoryTypePageCached(
  searchParams: BoardsBrowseSearchParams,
): Promise<BoardsBrowseCategoryTypePage | null> {
  if (!isBoardsBrowseCategoryTypeView(searchParams)) {
    return null
  }
  const { boardType, page } = boardsBrowseCategoryTypeCacheKey(searchParams)
  return getCachedBoardsBrowseCategoryTypePage(boardType, page)
}
