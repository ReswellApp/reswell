import { unstable_cache } from "next/cache"
import {
  boardsBrowseCategoryTypeCacheKey,
  fetchBoardsBrowseCategoryTypePage,
  isBoardsBrowseCategoryTypeView,
  isBoardsBrowseTopPicksSort,
  type BoardsBrowseCategoryTypePage,
} from "@/lib/db/boards-browse-listings"
import type { BoardsBrowseSearchParams } from "@/lib/marketplace-slug-metadata"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"
import { boardsBrowseDailyRotateSeed } from "@/lib/utils/boards-browse-daily-rotate"

/** Hourly cache for nav category views (`/boards`, `/boards?type=…`). */
export const BOARDS_BROWSE_CACHE_TAG = "boards-browse"
export const BOARDS_BROWSE_REVALIDATE_SECONDS = 60 * 60

export { isBoardsBrowseCategoryTypeView }

async function loadBoardsBrowseCategoryTypePage(
  boardType: string,
  condition: string,
  sort: string,
  page: number,
  rotateSeed: string,
): Promise<BoardsBrowseCategoryTypePage> {
  const supabase = createAnonSupabaseClient()
  return fetchBoardsBrowseCategoryTypePage(supabase, {
    boardType,
    condition,
    sort,
    page,
    rotateSeed,
  })
}

const getCachedBoardsBrowseCategoryTypePage = unstable_cache(
  loadBoardsBrowseCategoryTypePage,
  // `v3` includes the 24h rotate seed so unfiltered `/boards` reshuffles on a new day.
  ["boards-browse-category-type", "v3-daily-rotate"],
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
  const { boardType, condition, sort, page } = boardsBrowseCategoryTypeCacheKey(searchParams)
  const rotateSeed = isBoardsBrowseTopPicksSort(sort) ? boardsBrowseDailyRotateSeed() : ""
  return getCachedBoardsBrowseCategoryTypePage(boardType, condition, sort, page, rotateSeed)
}
