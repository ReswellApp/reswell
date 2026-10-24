import { unstable_cache } from "next/cache"
import {
  boardsBrowseCategoryTypeCacheKey,
  fetchBoardsBrowseCategoryTypePage,
  isBoardsBrowseCategoryTypeView,
  isBoardsBrowseTopPicksSort,
  type BoardsBrowseCategoryTypePage,
} from "@/lib/db/boards-browse-listings"
import type { BoardsBrowseSearchParams } from "@/lib/marketplace-slug-metadata"
import { getDb } from "@/lib/supabase/db"
import { boardsBrowseDailyRotateSeed } from "@/lib/utils/boards-browse-daily-rotate"

/** Hourly cache for nav category views (`/boards`, `/boards?type=…`). */
export const BOARDS_BROWSE_CACHE_TAG = "boards-browse"
export const BOARDS_BROWSE_REVALIDATE_SECONDS = 60 * 60

export { isBoardsBrowseCategoryTypeView }

const BOARDS_BROWSE_EMPTY_CACHE_ERROR = "Boards browse page empty — skip cache"

function isEmptyBoardsBrowsePage(page: BoardsBrowseCategoryTypePage): boolean {
  return page.boards.length === 0
}

/** Unfiltered `/boards` should never cache an empty cover — listings exist (home, ?sort=newest). */
function isPoisonedEmptyBoardsCover(
  page: BoardsBrowseCategoryTypePage,
  boardType: string,
  condition: string,
): boolean {
  return boardType === "all" && condition === "all" && isEmptyBoardsBrowsePage(page)
}

function loadBoardsBrowseCategoryTypePageFromDb(
  boardType: string,
  condition: string,
  sort: string,
  page: number,
  rotateSeed: string,
): Promise<BoardsBrowseCategoryTypePage> {
  // Primary read: a replica snapshot must not be cached as the live cover after a save.
  const supabase = getDb({ consistency: "strong" })
  return fetchBoardsBrowseCategoryTypePage(supabase, {
    boardType,
    condition,
    sort,
    page,
    rotateSeed,
  })
}

async function loadBoardsBrowseCategoryTypePage(
  boardType: string,
  condition: string,
  sort: string,
  page: number,
  rotateSeed: string,
): Promise<BoardsBrowseCategoryTypePage> {
  const result = await loadBoardsBrowseCategoryTypePageFromDb(
    boardType,
    condition,
    sort,
    page,
    rotateSeed,
  )
  // A failed rotate scan used to cache `{ boards: [] }` for an hour and hide
  // the live Postgres / ES paths. Refuse to persist that empty cover.
  if (isPoisonedEmptyBoardsCover(result, boardType, condition)) {
    throw new Error(BOARDS_BROWSE_EMPTY_CACHE_ERROR)
  }
  return result
}

const getCachedBoardsBrowseCategoryTypePage = unstable_cache(
  loadBoardsBrowseCategoryTypePage,
  // `v7` uses the created_at rotate scan + indexed fallback; busts the empty v6 cover.
  ["boards-browse-category-type", "v7-rotate-index-fallback"],
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

  // Dev: skip `unstable_cache` so a failed rotate scan cannot pin an empty /boards
  // cover until the TTL expires.
  if (process.env.NODE_ENV === "development") {
    const live = await loadBoardsBrowseCategoryTypePageFromDb(
      boardType,
      condition,
      sort,
      page,
      rotateSeed,
    )
    return isPoisonedEmptyBoardsCover(live, boardType, condition) ? null : live
  }

  try {
    const cached = await getCachedBoardsBrowseCategoryTypePage(
      boardType,
      condition,
      sort,
      page,
      rotateSeed,
    )
    if (isPoisonedEmptyBoardsCover(cached, boardType, condition)) return null
    return cached
  } catch (error) {
    const message = error instanceof Error ? error.message : ""
    if (message === BOARDS_BROWSE_EMPTY_CACHE_ERROR) return null
    throw error
  }
}
