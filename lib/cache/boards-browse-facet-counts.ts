import { unstable_cache } from "next/cache"
import {
  BOARDS_BROWSE_CACHE_TAG,
  BOARDS_BROWSE_REVALIDATE_SECONDS,
} from "@/lib/cache/boards-browse-catalog"
import { facetSelectionsFromBrowseParams } from "@/lib/boards-browse-facets"
import {
  fetchSurfboardFacetCountRows,
  type FacetCountContext,
  type FacetCountRow,
} from "@/lib/db/boards-browse-facet-counts"
import {
  isBoardsBrowseShippingAvailableParam,
  type BoardsBrowseSearchParams,
} from "@/lib/marketplace-slug-metadata"
import {
  computeBoardsBrowseFacetCounts,
  facetCountsByParamKey,
} from "@/lib/services/boardsBrowseFacetCounts"
import { boardsBrowseFacetCountsFromEs } from "@/lib/elasticsearch/boards-browse-search"
import { isBoardsBrowseEsEnabled } from "@/lib/db/boards-browse-listings-es"
import {
  mergeNlOverlayIntoFacets,
  resolveBoardsSearchQuery,
} from "@/lib/services/searchBoards"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"
import { isUuidString } from "@/lib/utils/isUuid"

function facetCountContextFromSearchParams(
  searchParams: BoardsBrowseSearchParams,
): FacetCountContext {
  return {
    query: searchParams.q,
    brand: searchParams.brand,
    model: searchParams.model,
    brandId: searchParams.brandId,
    brandModelId: searchParams.brandModelId,
    minPrice: searchParams.minPrice ? Number(searchParams.minPrice) : undefined,
    maxPrice: searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined,
    location: searchParams.location,
    shippingAvailable: isBoardsBrowseShippingAvailableParam(searchParams.shipping)
      ? true
      : undefined,
  }
}

async function loadSurfboardFacetCountRows(
  query: string,
  brand: string,
  model: string,
  brandId: string,
  brandModelId: string,
  minPrice: number | null,
  maxPrice: number | null,
  location: string,
  shippingAvailable: boolean,
): Promise<FacetCountRow[]> {
  const supabase = createAnonSupabaseClient()
  return fetchSurfboardFacetCountRows(supabase, {
    query: query || undefined,
    brand: brand || undefined,
    model: model || undefined,
    brandId: brandId || undefined,
    brandModelId: brandModelId || undefined,
    minPrice: minPrice ?? undefined,
    maxPrice: maxPrice ?? undefined,
    location: location || undefined,
    shippingAvailable: shippingAvailable || undefined,
  })
}

const getCachedSurfboardFacetCountRows = unstable_cache(
  loadSurfboardFacetCountRows,
  ["boards-browse-facet-count-rows", "v6"],
  {
    revalidate: BOARDS_BROWSE_REVALIDATE_SECONDS,
    tags: [BOARDS_BROWSE_CACHE_TAG],
  },
)

async function dbFacetCountsByParamKey(
  ctx: FacetCountContext,
  selections: ReturnType<typeof facetSelectionsFromBrowseParams>,
): Promise<Record<string, Record<string, number>>> {
  const rows = await getCachedSurfboardFacetCountRows(
    ctx.query?.trim() ?? "",
    ctx.brand?.trim() ?? "",
    ctx.model?.trim() ?? "",
    ctx.brandId?.trim() ?? "",
    ctx.brandModelId?.trim() ?? "",
    ctx.minPrice ?? null,
    ctx.maxPrice ?? null,
    ctx.location?.trim() ?? "",
    Boolean(ctx.shippingAvailable),
  )
  return facetCountsByParamKey(computeBoardsBrowseFacetCounts(rows, selections))
}

/** Viewer-independent facet counts for the browse filter UI (cached by search context). */
export async function getBoardsBrowseFacetCountsMapCached(
  searchParams: BoardsBrowseSearchParams,
): Promise<Record<string, Record<string, number>>> {
  const ctx = facetCountContextFromSearchParams(searchParams)
  const selections = facetSelectionsFromBrowseParams(searchParams)

  if (isBoardsBrowseEsEnabled()) {
    try {
      const supabase = createAnonSupabaseClient()
      const brandId = isUuidString(ctx.brandId?.trim() ?? "") ? ctx.brandId!.trim() : undefined
      const brandModelId = isUuidString(ctx.brandModelId?.trim() ?? "")
        ? ctx.brandModelId!.trim()
        : undefined
      const resolved = ctx.query?.trim()
        ? await resolveBoardsSearchQuery(supabase, {
            q: ctx.query,
            brandId,
            brandModelId,
            brand: ctx.brand,
            model: ctx.model,
          })
        : null

      const nl = resolved?.nl ?? null
      const esCounts = await boardsBrowseFacetCountsFromEs(
        {
          query: resolved?.context.query ?? ctx.query,
          brand: resolved?.context.brand ?? ctx.brand,
          model: resolved?.context.model ?? ctx.model,
          brandId: resolved?.context.brandId ?? brandId,
          brandModelId: resolved?.context.brandModelId ?? brandModelId,
          brandModelIds: resolved?.context.brandModelIds,
          expansions: resolved?.context.expansions,
          lengthInches: resolved?.context.lengthInches,
          minPrice: ctx.minPrice ?? nl?.minPrice,
          maxPrice: ctx.maxPrice ?? nl?.maxPrice,
          locationText: ctx.location?.trim() || nl?.locationText,
          shippingAvailable: ctx.shippingAvailable ?? nl?.shippingAvailable,
        },
        mergeNlOverlayIntoFacets(selections, nl),
      )
      // ES docs index resolved length/volume (listingRowToSearchDocFromRow), so all facet
      // counts — including range buckets — come from the same source as the search results.
      if (esCounts) return facetCountsByParamKey(esCounts)
    } catch (error) {
      console.error("[boards-browse] ES facet counts failed, falling back to DB:", error)
    }
  }

  return dbFacetCountsByParamKey(ctx, selections)
}
