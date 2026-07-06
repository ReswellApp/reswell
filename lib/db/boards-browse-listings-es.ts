import type { SupabaseClient } from "@supabase/supabase-js"
import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import {
  searchBoardsBrowse,
  type BoardsBrowseEsSearchParams,
} from "@/lib/elasticsearch/boards-browse-search"
import { BOARDS_BROWSE_NEWEST_SORT } from "@/lib/marketplace-slug-metadata"
import {
  BOARDS_BROWSE_PAGE_SIZE,
  isBoardsBrowseTopPicksSort,
  SURFBOARD_BROWSE_LISTING_SELECT,
  type BoardBrowseListingRow,
  type BoardsBrowseCategoryTypePage,
} from "@/lib/db/boards-browse-listings"
import { listBoardsBrowseTopPickListingIdsOrdered } from "@/lib/db/boards-browse-top-picks"
import { sortRecordsByIdOrder } from "@/lib/utils/sort-by-id-order"

/**
 * Whether `/boards` browse results + facet counts should be served by Elasticsearch.
 * Requires a configured cluster; set `BOARDS_BROWSE_USE_ES=false` to force the Postgres path
 * (e.g. before the index has been reindexed with the new facet/geo fields).
 */
export function isBoardsBrowseEsEnabled(): boolean {
  if (process.env.BOARDS_BROWSE_USE_ES === "false") return false
  return isElasticsearchConfigured()
}

/** Fetch full browse rows for `ids`, preserving order and dropping now-invisible listings. */
export async function hydrateBoardsBrowseByIds(
  supabase: SupabaseClient,
  ids: string[],
): Promise<BoardBrowseListingRow[]> {
  if (ids.length === 0) return []

  const { data, error } = await supabase
    .from("listings")
    .select(SURFBOARD_BROWSE_LISTING_SELECT)
    .in("id", ids)
    .eq("status", "active")
    .eq("section", "surfboards")
    .eq("hidden_from_site", false)

  if (error || !data) return []

  return sortRecordsByIdOrder(data as unknown as BoardBrowseListingRow[], ids)
}

/** Shared filter/context inputs for an Elasticsearch browse page. */
export type BoardsBrowseEsPageInput = Omit<
  BoardsBrowseEsSearchParams,
  "from" | "size" | "restrictToIds" | "excludeIds" | "useSuppressionSort"
> & {
  page: number
}

/**
 * Elasticsearch-backed browse page. Returns hydrated rows + total pages, or `null` when
 * Elasticsearch is unavailable so callers can fall back to Postgres. Empty ES results also
 * return `null` so the Postgres "nearest listings" fallback (wider radius / dropped keyword)
 * still runs and produces a helpful notice.
 */
export async function getBoardsBrowseListingsPageViaEs(
  supabase: SupabaseClient,
  input: BoardsBrowseEsPageInput,
): Promise<BoardsBrowseCategoryTypePage | null> {
  const limit = BOARDS_BROWSE_PAGE_SIZE
  const offset = (input.page - 1) * limit
  const isGeo = Boolean(input.geo)
  const isTopPicks = isBoardsBrowseTopPicksSort(input.sort)

  const ids = isTopPicks && !isGeo
    ? await topPicksPageIds(supabase, input, offset, limit)
    : await standardPageIds(input, offset, limit)

  if (ids === null) return null
  if (ids.orderedIds.length === 0 && ids.total === 0) return null

  const boards = await hydrateBoardsBrowseByIds(supabase, ids.orderedIds)
  if (boards.length === 0) return null

  const totalPages = ids.total === 0 ? 0 : Math.max(1, Math.ceil(ids.total / limit))
  return { boards, totalPages }
}

type PageIds = { orderedIds: string[]; total: number }

async function standardPageIds(
  input: BoardsBrowseEsPageInput,
  offset: number,
  limit: number,
): Promise<PageIds | null> {
  const res = await searchBoardsBrowse({
    ...input,
    useSuppressionSort: true,
    from: offset,
    size: limit,
  })
  if (!res) return null
  return { orderedIds: res.ids, total: res.total }
}

/** Admin Top Picks pinned first (curation order), then newest — paginated across the boundary. */
async function topPicksPageIds(
  supabase: SupabaseClient,
  input: BoardsBrowseEsPageInput,
  offset: number,
  limit: number,
): Promise<PageIds | null> {
  const curatedIds = await listBoardsBrowseTopPickListingIdsOrdered(supabase)
  if (curatedIds.length === 0) {
    return standardPageIds({ ...input, sort: BOARDS_BROWSE_NEWEST_SORT }, offset, limit)
  }

  const pickMatch = await searchBoardsBrowse({
    ...input,
    sort: BOARDS_BROWSE_NEWEST_SORT,
    useSuppressionSort: true,
    restrictToIds: curatedIds,
    from: 0,
    size: curatedIds.length,
  })
  if (!pickMatch) return null

  const matched = new Set(pickMatch.ids)
  const orderedPickIds = curatedIds.filter((id) => matched.has(id))
  const pickCount = orderedPickIds.length

  let pickSlice: string[]
  let nonPickFrom: number
  let nonPickSize: number
  if (offset >= pickCount) {
    pickSlice = []
    nonPickFrom = offset - pickCount
    nonPickSize = limit
  } else if (offset + limit <= pickCount) {
    pickSlice = orderedPickIds.slice(offset, offset + limit)
    nonPickFrom = 0
    nonPickSize = 0
  } else {
    pickSlice = orderedPickIds.slice(offset)
    nonPickFrom = 0
    nonPickSize = limit - pickSlice.length
  }

  const nonPick = await searchBoardsBrowse({
    ...input,
    sort: BOARDS_BROWSE_NEWEST_SORT,
    useSuppressionSort: true,
    excludeIds: curatedIds,
    from: nonPickFrom,
    size: nonPickSize,
  })
  if (!nonPick) return null

  return {
    orderedIds: [...pickSlice, ...nonPick.ids],
    total: pickCount + nonPick.total,
  }
}
