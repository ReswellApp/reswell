import { unstable_cache } from "next/cache"
import {
  BOARDS_BROWSE_CACHE_TAG,
  BOARDS_BROWSE_REVALIDATE_SECONDS,
} from "@/lib/cache/boards-browse-catalog"
import { facetSelectionsFromParams } from "@/lib/boards-browse-facets"
import {
  fetchSurfboardFacetCountRows,
  type FacetCountContext,
  type FacetCountRow,
} from "@/lib/db/boards-browse-facet-counts"
import type { BoardsBrowseSearchParams } from "@/lib/marketplace-slug-metadata"
import {
  computeBoardsBrowseFacetCounts,
  facetCountsByParamKey,
} from "@/lib/services/boardsBrowseFacetCounts"
import { boardsBrowseFacetCountsFromEs } from "@/lib/elasticsearch/boards-browse-search"
import { isBoardsBrowseEsEnabled } from "@/lib/db/boards-browse-listings-es"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"

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
  })
}

const getCachedSurfboardFacetCountRows = unstable_cache(
  loadSurfboardFacetCountRows,
  ["boards-browse-facet-count-rows", "v2"],
  {
    revalidate: BOARDS_BROWSE_REVALIDATE_SECONDS,
    tags: [BOARDS_BROWSE_CACHE_TAG],
  },
)

/** Viewer-independent facet counts for the browse filter UI (cached by search context). */
export async function getBoardsBrowseFacetCountsMapCached(
  searchParams: BoardsBrowseSearchParams,
): Promise<Record<string, Record<string, number>>> {
  const ctx = facetCountContextFromSearchParams(searchParams)
  const selections = facetSelectionsFromParams(searchParams)

  if (isBoardsBrowseEsEnabled()) {
    try {
      const esCounts = await boardsBrowseFacetCountsFromEs(
        {
          query: ctx.query,
          brand: ctx.brand,
          model: ctx.model,
          brandId: ctx.brandId,
          brandModelId: ctx.brandModelId,
          minPrice: ctx.minPrice,
          maxPrice: ctx.maxPrice,
          locationText: ctx.location,
        },
        selections,
      )
      if (esCounts) return facetCountsByParamKey(esCounts)
    } catch (error) {
      console.error("[boards-browse] ES facet counts failed, falling back to DB:", error)
    }
  }

  const rows = await getCachedSurfboardFacetCountRows(
    ctx.query?.trim() ?? "",
    ctx.brand?.trim() ?? "",
    ctx.model?.trim() ?? "",
    ctx.brandId?.trim() ?? "",
    ctx.brandModelId?.trim() ?? "",
    ctx.minPrice ?? null,
    ctx.maxPrice ?? null,
    ctx.location?.trim() ?? "",
  )
  return facetCountsByParamKey(computeBoardsBrowseFacetCounts(rows, selections))
}
