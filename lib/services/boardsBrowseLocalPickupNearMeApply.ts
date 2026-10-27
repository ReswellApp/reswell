import { getLocalPickupNearMePreferenceForBrowse } from "@/lib/cache/local-pickup-near-me-preference"
import type { BoardsBrowseSearchParams } from "@/lib/marketplace-slug-metadata"
import {
  mergeLocalPickupNearMeIntoBrowseParams,
  type BoardsBrowseEffectiveFilters,
} from "@/lib/services/boardsBrowseLocalPickupNearMeMerge"

/** Loads cached near-me preference and merges it into browse URL params. */
export async function loadMergedBoardsBrowseFilters(
  userId: string | null | undefined,
  searchParams: BoardsBrowseSearchParams,
): Promise<BoardsBrowseEffectiveFilters> {
  const pref = await getLocalPickupNearMePreferenceForBrowse(userId)
  return mergeLocalPickupNearMeIntoBrowseParams(searchParams, pref)
}
