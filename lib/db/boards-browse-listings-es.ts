import type { SupabaseClient } from "@supabase/supabase-js"
import { isElasticsearchConfigured } from "@/lib/elasticsearch/config"
import {
  searchBoardsBrowse,
  type BoardsBrowseEsSearchParams,
} from "@/lib/elasticsearch/boards-browse-search"
import { hasAnyFacetSelection } from "@/lib/boards-browse-facets"
import {
  BOARDS_BROWSE_PAGE_SIZE,
  SURFBOARD_BROWSE_LISTING_SELECT,
  type BoardBrowseListingRow,
  type BoardsBrowseCategoryTypePage,
} from "@/lib/db/boards-browse-listings"
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
    .is("archived_at", null)

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

/** Empty ES results that must not fall through to Postgres ILIKE / unfiltered browse. */
function isLockedEmptyEsResult(input: BoardsBrowseEsPageInput): boolean {
  return (
    Boolean(input.query?.trim()) ||
    Boolean(input.rankQuery?.trim()) ||
    Boolean(input.brandId?.trim()) ||
    Boolean(input.brandModelId?.trim()) ||
    (input.brandModelIds?.length ?? 0) > 0 ||
    (input.boostBrandModelIds?.length ?? 0) > 0 ||
    Boolean(input.boostBrandId?.trim()) ||
    input.lengthInches != null ||
    (input.tailShapes?.length ?? 0) > 0 ||
    input.minPrice != null ||
    input.maxPrice != null ||
    Boolean(input.shippingAvailable) ||
    Boolean(input.facets && hasAnyFacetSelection(input.facets))
  )
}

/**
 * Elasticsearch-backed browse page. Returns hydrated rows + total pages, or `null` when
 * Elasticsearch is unavailable so callers can fall back to Postgres (non-keyword browse only).
 * Keyword / facet / shipping empties return `{ boards: [], totalPages: 0 }` so Postgres
 * never re-runs the same search with ILIKE.
 */
export async function getBoardsBrowseListingsPageViaEs(
  supabase: SupabaseClient,
  input: BoardsBrowseEsPageInput,
): Promise<BoardsBrowseCategoryTypePage | null> {
  const limit = BOARDS_BROWSE_PAGE_SIZE
  const offset = (input.page - 1) * limit
  const ids = await standardPageIds(input, offset, limit)

  if (ids === null) return null
  if (ids.orderedIds.length === 0 && ids.total === 0) {
    if (isLockedEmptyEsResult(input)) {
      return { boards: [], totalPages: 0 }
    }
    return null
  }

  const boards = await hydrateBoardsBrowseByIds(supabase, ids.orderedIds)
  if (boards.length === 0) {
    if (isLockedEmptyEsResult(input)) {
      return { boards: [], totalPages: 0 }
    }
    return null
  }

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
