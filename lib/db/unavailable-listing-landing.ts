import type { SupabaseClient } from "@supabase/supabase-js"
import {
  BOARDS_BROWSE_PAGE_SIZE,
  buildSurfboardBrowseBaseQuery,
  fetchBoardsBrowseTopPicksPage,
  type BoardBrowseListingRow,
} from "@/lib/db/boards-browse-listings"
import { isBoardsBrowseSuppressionSortAvailable } from "@/lib/db/boards-browse-suppressed-admin"
import {
  BOARDS_BROWSE_NEWEST_SORT,
  browseTypeParamFromBoardType,
} from "@/lib/marketplace-slug-metadata"

export const UNAVAILABLE_LISTING_CONTEXT_SELECT =
  "id, slug, title, section, status, hidden_from_site, brand, brand_id, board_type, user_id"

const RELATED_SURFBOARDS_LIMIT = 16

export type UnavailableListingContextRow = {
  id: string
  slug: string | null
  title: string | null
  section: string
  status: string
  hidden_from_site: boolean | null
  brand: string | null
  brand_id: string | null
  board_type: string | null
  user_id: string
}

export type UnavailableListingRelatedSurfboard = Record<string, unknown>

type RelatedBrowseQueryOpts = {
  boardTypeParam: string
  brandId?: string
  brandLabel?: string
  excludeListingId?: string
  limit: number
  useSuppressionSort: boolean
}

/** Runs a browse query with optional suppression-sort retry (matches `/boards` db helpers). */
async function fetchRelatedBrowseRows(
  supabase: SupabaseClient,
  opts: RelatedBrowseQueryOpts,
): Promise<BoardBrowseListingRow[]> {
  const fetchLimit = opts.limit + (opts.excludeListingId ? 4 : 0)
  const baseParams = {
    boardType: opts.boardTypeParam,
    condition: "all" as const,
    query: "",
    brandId: opts.brandId,
    brand: opts.brandId ? undefined : opts.brandLabel,
    pagedSort: BOARDS_BROWSE_NEWEST_SORT,
    pagedRange: { from: 0, to: fetchLimit },
  }

  let chain = await buildSurfboardBrowseBaseQuery(supabase, {
    ...baseParams,
    useSuppressionSort: opts.useSuppressionSort,
  })
  let { data, error } = await chain

  if (error && opts.useSuppressionSort) {
    chain = await buildSurfboardBrowseBaseQuery(supabase, {
      ...baseParams,
      useSuppressionSort: false,
    })
    ;({ data, error } = await chain)
  }

  if (error) return []
  return ((data ?? []) as BoardBrowseListingRow[]).slice(0, fetchLimit)
}

export async function fetchRelatedSurfboardsForUnavailableListing(
  supabase: SupabaseClient,
  opts: {
    excludeListingId?: string
    brandId?: string | null
    brandLabel?: string | null
    boardType?: string | null
    limit?: number
  },
): Promise<UnavailableListingRelatedSurfboard[]> {
  const limit = Math.min(Math.max(opts.limit ?? RELATED_SURFBOARDS_LIMIT, 1), 24)
  const brandId = opts.brandId?.trim() || undefined
  const brandLabel = opts.brandLabel?.trim() || undefined
  const boardTypeParam = browseTypeParamFromBoardType(opts.boardType) ?? "all"

  const useSuppressionSort = await isBoardsBrowseSuppressionSortAvailable(supabase)
  const queryOpts = {
    boardTypeParam,
    brandId,
    brandLabel,
    excludeListingId: opts.excludeListingId,
    limit,
    useSuppressionSort,
  }

  let rows = filterUnavailableRelatedRows(
    await fetchRelatedBrowseRows(supabase, queryOpts),
    opts.excludeListingId,
    limit,
  )
  if (rows.length > 0 || (!brandId && !brandLabel)) return rows

  /** Brand-only match empty — try board type without brand. */
  if (boardTypeParam === "all") return rows

  rows = filterUnavailableRelatedRows(
    await fetchRelatedBrowseRows(supabase, {
      ...queryOpts,
      brandId: undefined,
      brandLabel: undefined,
    }),
    opts.excludeListingId,
    limit,
  )
  return rows
}

function filterUnavailableRelatedRows(
  data: BoardBrowseListingRow[],
  excludeListingId: string | undefined,
  limit: number,
): UnavailableListingRelatedSurfboard[] {
  const filtered = excludeListingId
    ? data.filter((row) => row.id !== excludeListingId)
    : data
  return filtered.slice(0, limit) as UnavailableListingRelatedSurfboard[]
}

/** First page of active surfboards — same filters as `/boards` with no query params. */
export async function fetchBoardsBrowsePreviewForUnavailableLanding(
  supabase: SupabaseClient,
  opts?: { pageSize?: number },
): Promise<BoardBrowseListingRow[]> {
  const pageSize = opts?.pageSize ?? BOARDS_BROWSE_PAGE_SIZE
  const { boards } = await fetchBoardsBrowseTopPicksPage(supabase, {
    boardType: "all",
    condition: "all",
    query: "",
    page: 1,
  })
  return boards.slice(0, pageSize)
}
