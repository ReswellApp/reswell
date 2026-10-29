import { getProfileBrowseHomeForBrowse } from "@/lib/cache/profile-browse-home"
import type { BoardsBrowseSearchParams } from "@/lib/marketplace-slug-metadata"
import {
  mergeProfileBrowseHomeIntoBrowseParams,
  type BoardsBrowseEffectiveFilters,
} from "@/lib/services/boardsBrowseProfileHomeMerge"

/** Loads cached profile home area and merges it into browse URL params (`home=off` opts out). */
export async function loadMergedBoardsBrowseFilters(
  userId: string | null | undefined,
  searchParams: BoardsBrowseSearchParams,
): Promise<BoardsBrowseEffectiveFilters> {
  const home = await getProfileBrowseHomeForBrowse(userId)
  return mergeProfileBrowseHomeIntoBrowseParams(searchParams, home)
}
