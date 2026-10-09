import type { MobileCategoryListingsQuery, MobileListingCard, MobileListingCategory, MobileListingsPage } from "@reswell/api-contract"
import { accessoryFacetSelectionsFromParams } from "@/lib/accessories-browse-facets"
import { apparelFacetSelectionsFromParams } from "@/lib/apparel-browse-facets"
import { boardbagFacetSelectionsFromParams } from "@/lib/boardbags-browse-facets"
import { facetSelectionsFromBrowseParams } from "@/lib/boards-browse-facets"
import { boardsBrowseEffectiveSort, boardsBrowseHasSidebarFilters } from "@/lib/boards-browse-sidebar-filters"
import { fetchAccessoriesBrowsePage } from "@/lib/db/accessory-listings"
import { fetchApparelBrowsePage } from "@/lib/db/apparel-listings"
import { fetchBoardbagsBrowsePage } from "@/lib/db/boardbag-listings"
import {
  BOARDS_BROWSE_PAGE_SIZE,
  buildSurfboardBrowseBaseQuery,
  fetchBoardsBrowseCategoryTypePage,
  isBoardsBrowseCategoryTypeView,
} from "@/lib/db/boards-browse-listings"
import { fetchFinsBrowsePage } from "@/lib/db/fin-listings"
import { listMobileListingRowsByIds } from "@/lib/db/mobile-listings"
import { fetchLeashesBrowsePage } from "@/lib/db/leash-listings"
import { fetchMagazinesBrowsePage } from "@/lib/db/magazine-listings"
import { fetchSurfpacksBrowsePage } from "@/lib/db/surfpack-listings"
import { fetchTractionBrowsePage } from "@/lib/db/traction-listings"
import { fetchWetsuitsBrowsePage } from "@/lib/db/wetsuit-listings"
import { finFacetSelectionsFromParams } from "@/lib/fins-browse-facets"
import { leashFacetSelectionsFromParams } from "@/lib/leashes-browse-facets"
import { magazineFacetSelectionsFromParams } from "@/lib/magazines-browse-facets"
import { BOARDS_BROWSE_DEFAULT_SORT, BOARDS_BROWSE_NEWEST_SORT } from "@/lib/marketplace-slug-metadata"
import { isListingPubliclyVisible } from "@/lib/listing-public-visibility"
import { surfpackFacetSelectionsFromParams } from "@/lib/surfpacks-browse-facets"
import { tractionFacetSelectionsFromParams } from "@/lib/traction-browse-facets"
import { getDb } from "@/lib/supabase/db"
import { wetsuitFacetSelectionsFromParams } from "@/lib/wetsuits-browse-facets"
import { toMobileListingCard, type MobileApiResult } from "@/lib/services/mobileApi"

const CATEGORY_PAGE_SIZE = 20

type IdRow = { id: string }

function pageFor(offset: number, limit: number): number {
  return Math.floor(offset / limit) + 1
}

async function cardsForIds(
  ids: string[],
  offset: number,
  limit: number,
  hasMore: boolean,
): Promise<MobileApiResult<MobileListingsPage>> {
  const listed = await listMobileListingRowsByIds(ids)
  if (!listed.ok) {
    return { ok: false, status: 500, error: "Unable to load listings right now" }
  }
  const listings: MobileListingCard[] = []
  for (const row of listed.rows) {
    if (!isListingPubliclyVisible(row)) continue
    const card = toMobileListingCard(row)
    if (card) listings.push(card)
  }
  return {
    ok: true,
    data: { listings, limit, offset, has_more: hasMore },
  }
}

async function listSurfboards(
  query: MobileCategoryListingsQuery,
): Promise<MobileApiResult<MobileListingsPage>> {
  const shipping = query.shipping === "1"
  const params = {
    type: query.type,
    style: query.style,
    condition: query.condition,
    fin: query.fin,
    finSystem: query.finSystem,
    construction: query.construction,
    length: query.length,
    volume: query.volume,
    shipping: shipping ? "1" : undefined,
    sort: query.sort === "relevant" ? BOARDS_BROWSE_DEFAULT_SORT : query.sort,
  }
  const hasSidebarFilters = boardsBrowseHasSidebarFilters(params)
  const sort = boardsBrowseEffectiveSort(params.sort, hasSidebarFilters, false)
  const supabase = getDb({ consistency: "eventual", purpose: "catalog" })

  if (isBoardsBrowseCategoryTypeView({ ...params, sort, page: "1" })) {
    const limit = BOARDS_BROWSE_PAGE_SIZE
    const page = pageFor(query.offset, limit)
    const result = await fetchBoardsBrowseCategoryTypePage(supabase, {
      boardType: query.type ?? "all",
      condition: query.condition?.includes(",") ? "all" : query.condition?.trim() || "all",
      sort,
      page,
    })
    return cardsForIds(
      result.boards.map((row) => row.id),
      (page - 1) * limit,
      limit,
      page < result.totalPages,
    )
  }

  const limit = CATEGORY_PAGE_SIZE
  const offset = (pageFor(query.offset, limit) - 1) * limit
  const facets = facetSelectionsFromBrowseParams(params)
  const chain = await buildSurfboardBrowseBaseQuery(supabase, {
    boardType: "all",
    condition: "all",
    query: "",
    facets,
    shippingAvailable: shipping || undefined,
    pagedSort: sort === BOARDS_BROWSE_DEFAULT_SORT ? BOARDS_BROWSE_NEWEST_SORT : sort,
    pagedRange: { from: offset, to: offset + limit - 1 },
    useSuppressionSort: false,
  })
  const { data, error, count } = await chain
  if (error) {
    console.error("[mobile-api] surfboard category failed", {
      timestamp: new Date().toISOString(),
      message: error.message,
    })
    return { ok: false, status: 500, error: "Unable to load listings right now" }
  }
  const rows = (data ?? []) as IdRow[]
  const total = count ?? rows.length
  return cardsForIds(
    rows.map((row) => row.id),
    offset,
    limit,
    offset + rows.length < total,
  )
}

async function listPeer(
  slug: Exclude<MobileListingCategory, "surfboards">,
  query: MobileCategoryListingsQuery,
): Promise<{ ids: string[]; totalPages: number }> {
  const supabase = getDb({ consistency: "eventual", purpose: "catalog" })
  const limit = CATEGORY_PAGE_SIZE
  const page = pageFor(query.offset, limit)
  const sort = query.sort === "relevant" ? "newest" : query.sort
  const shared = { query: undefined, sort, page, limit }
  switch (slug) {
    case "fins": {
      const result = await fetchFinsBrowsePage(supabase, {
        ...shared,
        facets: finFacetSelectionsFromParams(query),
      })
      return { ids: result.fins.map((row) => row.id), totalPages: result.totalPages }
    }
    case "wetsuits": {
      const result = await fetchWetsuitsBrowsePage(supabase, {
        ...shared,
        facets: wetsuitFacetSelectionsFromParams(query),
      })
      return { ids: result.wetsuits.map((row) => row.id), totalPages: result.totalPages }
    }
    case "traction": {
      const result = await fetchTractionBrowsePage(supabase, {
        ...shared,
        facets: tractionFacetSelectionsFromParams(query),
      })
      return { ids: result.traction.map((row) => row.id), totalPages: result.totalPages }
    }
    case "apparel": {
      const result = await fetchApparelBrowsePage(supabase, {
        ...shared,
        facets: apparelFacetSelectionsFromParams(query),
      })
      return { ids: result.apparel.map((row) => row.id), totalPages: result.totalPages }
    }
    case "leashes": {
      const result = await fetchLeashesBrowsePage(supabase, {
        ...shared,
        facets: leashFacetSelectionsFromParams(query),
      })
      return { ids: result.leashes.map((row) => row.id), totalPages: result.totalPages }
    }
    case "boardbags": {
      const result = await fetchBoardbagsBrowsePage(supabase, {
        ...shared,
        facets: boardbagFacetSelectionsFromParams(query),
      })
      return { ids: result.boardbags.map((row) => row.id), totalPages: result.totalPages }
    }
    case "surfpacks": {
      const result = await fetchSurfpacksBrowsePage(supabase, {
        ...shared,
        facets: surfpackFacetSelectionsFromParams(query),
      })
      return { ids: result.surfpacks.map((row) => row.id), totalPages: result.totalPages }
    }
    case "accessories": {
      const result = await fetchAccessoriesBrowsePage(supabase, {
        ...shared,
        facets: accessoryFacetSelectionsFromParams(query),
      })
      return { ids: result.accessories.map((row) => row.id), totalPages: result.totalPages }
    }
    case "magazines": {
      const result = await fetchMagazinesBrowsePage(supabase, {
        ...shared,
        facets: magazineFacetSelectionsFromParams(query),
      })
      return { ids: result.magazines.map((row) => row.id), totalPages: result.totalPages }
    }
  }
}

export async function listMobileCategoryListingsService(
  slug: MobileListingCategory,
  query: MobileCategoryListingsQuery,
): Promise<MobileApiResult<MobileListingsPage>> {
  if (slug === "surfboards") return listSurfboards(query)
  const limit = CATEGORY_PAGE_SIZE
  const page = pageFor(query.offset, limit)
  const listed = await listPeer(slug, query)
  return cardsForIds(listed.ids, (page - 1) * limit, limit, page < listed.totalPages)
}
