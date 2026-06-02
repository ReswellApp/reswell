import type { SupabaseClient } from "@supabase/supabase-js"
import {
  BOARDS_BROWSE_PAGE_SIZE,
  buildSurfboardBrowseBaseQuery,
  fetchBoardsBrowseTopPicksPage,
  type BoardBrowseListingRow,
} from "@/lib/db/boards-browse-listings"
import { isBoardsBrowseSuppressionSortAvailable } from "@/lib/db/boards-browse-suppressed-admin"
import { BOARDS_BROWSE_NEWEST_SORT } from "@/lib/marketplace-slug-metadata"

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

  let chain = (await buildSurfboardBrowseBaseQuery(supabase, {
    boardType: boardTypeParam,
    condition: "all",
    query: "",
    brandId: brandId || undefined,
    brand: brandId ? undefined : brandLabel,
    useSuppressionSort,
    pagedSort: BOARDS_BROWSE_NEWEST_SORT,
    pagedRange: { from: 0, to: limit + (opts.excludeListingId ? 4 : 0) },
  })) as Awaited<ReturnType<typeof buildSurfboardBrowseBaseQuery>>

  const { data, error } = await chain
  if (error) {
    if (useSuppressionSort) {
      chain = (await buildSurfboardBrowseBaseQuery(supabase, {
        boardType: boardTypeParam,
        condition: "all",
        query: "",
        brandId: brandId || undefined,
        brand: brandId ? undefined : brandLabel,
        useSuppressionSort: false,
        pagedSort: BOARDS_BROWSE_NEWEST_SORT,
        pagedRange: { from: 0, to: limit + (opts.excludeListingId ? 4 : 0) },
      })) as Awaited<ReturnType<typeof buildSurfboardBrowseBaseQuery>>
      const retry = await chain
      if (retry.error) return []
      return filterUnavailableRelatedRows(retry.data, opts.excludeListingId, limit)
    }
    return []
  }

  let rows = filterUnavailableRelatedRows(data, opts.excludeListingId, limit)
  if (rows.length > 0 || (!brandId && !brandLabel)) return rows

  /** Brand-only match empty — try board type without brand. */
  if (boardTypeParam === "all") return rows

  chain = (await buildSurfboardBrowseBaseQuery(supabase, {
    boardType: boardTypeParam,
    condition: "all",
    query: "",
    useSuppressionSort,
    pagedSort: BOARDS_BROWSE_NEWEST_SORT,
    pagedRange: { from: 0, to: limit + (opts.excludeListingId ? 4 : 0) },
  })) as Awaited<ReturnType<typeof buildSurfboardBrowseBaseQuery>>

  const fallback = await chain
  if (fallback.error) return rows
  return filterUnavailableRelatedRows(fallback.data, opts.excludeListingId, limit)
}

function filterUnavailableRelatedRows(
  data: BoardBrowseListingRow[] | null,
  excludeListingId: string | undefined,
  limit: number,
): UnavailableListingRelatedSurfboard[] {
  const raw = (data ?? []) as UnavailableListingRelatedSurfboard[]
  const filtered = excludeListingId
    ? raw.filter((row) => String(row.id) !== excludeListingId)
    : raw
  return filtered.slice(0, limit)
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
