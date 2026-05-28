import type { SupabaseClient } from "@supabase/supabase-js"
import type { PostgrestClientOptions, PostgrestFilterBuilder } from "@supabase/postgrest-js"
import { applyListingsLocationTextFilter } from "@/lib/listing-location-or-filter"
import type { ListingImageForCard } from "@/lib/listing-image-display"
import {
  boardTypeForDbFromBrowseParam,
  BOARDS_BROWSE_DEFAULT_SORT,
  normalizedBoardsBrowseTypeFromParam,
  type BoardsBrowseSearchParams,
} from "@/lib/marketplace-slug-metadata"
import { isBoardsBrowseSuppressionSortAvailable } from "@/lib/db/boards-browse-suppressed-admin"
import {
  boardDimensionBrowseFieldsFromSearchParams,
  boardDimensionBrowseIlikeTokens,
  type BoardDimensionBrowseFields,
} from "@/lib/utils/board-dimension-browse-filter"
import { isUuidString } from "@/lib/utils/isUuid"

/**
 * Explicit chain type so `async function` return is not inferred as `PostgrestSingleResponse`
 * (PostgREST builders are `PromiseLike` their own HTTP result).
 */
export type SurfboardBrowseListingsQuery = PostgrestFilterBuilder<
  PostgrestClientOptions,
  // Generated `Database` type is not wired for this client; keep builder chain loose.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  Record<string, unknown>,
  Record<string, unknown>[],
  unknown,
  unknown,
  unknown
>

export type BoardBrowseListingRow = {
  id: string
  slug: string | null
  user_id: string
  title: string
  price: number | string
  status: string
  created_at?: string
  latitude?: number | null
  longitude?: number | null
  local_pickup?: boolean | null
  shipping_available?: boolean | null
  listing_images?: ListingImageForCard[] | null
  categories?: { name?: string | null } | null | { name?: string | null }[] | null
  board_type?: string | null
  condition?: string | null
  suppressed_on_boards_browse?: boolean | null
}

export const SURFBOARD_BROWSE_LISTING_SELECT = `
  *,
  listing_images (url, thumbnail_url, is_primary),
  categories (name),
  profiles!listings_user_id_fkey (display_name, avatar_url, location, shop_verified)
`

export const BOARDS_BROWSE_PAGE_SIZE = 30

export const LOCATION_FALLBACK_RADIUS_MI = 100
export const LOCATION_FALLBACK_WIDE_RADIUS_MI = 2200

export function suppressedBrowseRank(row: BoardBrowseListingRow): number {
  return row.suppressed_on_boards_browse === true ? 1 : 0
}

export function compareBoardBrowseRows(
  a: BoardBrowseListingRow,
  b: BoardBrowseListingRow,
  sort: string,
): number {
  const supDiff = suppressedBrowseRank(a) - suppressedBrowseRank(b)
  if (supDiff !== 0) return supDiff

  const pa = Number(a.price ?? 0)
  const pb = Number(b.price ?? 0)
  const ta = new Date(a.created_at ?? 0).getTime()
  const tb = new Date(b.created_at ?? 0).getTime()
  if (sort === "price-low") return pa - pb
  if (sort === "price-high") return pb - pa
  if (sort === "price-newest") {
    const priceDiff = pb - pa
    if (priceDiff !== 0) return priceDiff
  }
  return tb - ta
}

export function haversineMi(
  lat1: number,
  lon1: number,
  lat2: number | null | undefined,
  lon2: number | null | undefined,
): number {
  if (lat2 == null || lon2 == null) return Infinity
  const R = 3959
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function escapePostgrestIlikeFragment(fragment: string): string {
  return fragment.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
}

function ilikeContainsPattern(fragment: string): string {
  return `"%${escapePostgrestIlikeFragment(fragment)}%"`
}

/** Narrow listings to a lat/lng window (~miles) before other filters that use `.or()`. */
function geoBoundingBoxFiltersMiles(lat: number, lng: number, radiusMiles: number) {
  const pad = 1.08
  const mi = radiusMiles * pad
  const dLat = mi / 69
  const cosLat = Math.cos((lat * Math.PI) / 180)
  const dLng = mi / (69 * Math.max(Math.abs(cosLat), 0.15))
  return { minLat: lat - dLat, maxLat: lat + dLat, minLng: lng - dLng, maxLng: lng + dLng }
}

/** Shared keyword, type, condition, price, sort, location, and pagination filters for /boards. */
export async function buildSurfboardBrowseBaseQuery(
  supabase: SupabaseClient,
  params: {
    boardType: string
    condition: string
    query: string
    brand?: string
    model?: string
    brandId?: string
    brandModelId?: string
    dimensionFields?: BoardDimensionBrowseFields
    /** Legacy `dimensions=` query param (single substring). */
    legacyDimensions?: string
    minPrice?: number
    maxPrice?: number
    geoBbox?: { lat: number; lng: number; radiusMiles: number }
    rangeBeforeKeywordOr?: { from: number; to: number }
    pagedRange?: { from: number; to: number }
    prependCreatedAtOrder?: boolean
    pagedSort?: string
    locationTextFilter?: string
    useSuppressionSort?: boolean
  },
): Promise<SurfboardBrowseListingsQuery> {
  let dbQuery = supabase
    .from("listings")
    .select(SURFBOARD_BROWSE_LISTING_SELECT, { count: "exact" })
    .eq("status", "active")
    .eq("section", "surfboards")
    .eq("hidden_from_site", false)

  if (params.boardType !== "all") {
    const dbBoardType = boardTypeForDbFromBrowseParam(params.boardType)
    if (dbBoardType) {
      dbQuery = dbQuery.eq("board_type", dbBoardType)
    }
  }

  if (params.condition !== "all") {
    dbQuery = dbQuery.eq("condition", params.condition)
  }

  if (params.minPrice != null && !Number.isNaN(params.minPrice) && params.minPrice >= 0) {
    dbQuery = dbQuery.gte("price", params.minPrice)
  }
  if (params.maxPrice != null && !Number.isNaN(params.maxPrice) && params.maxPrice >= 0) {
    dbQuery = dbQuery.lte("price", params.maxPrice)
  }

  if (params.prependCreatedAtOrder) {
    if (params.useSuppressionSort) {
      dbQuery = dbQuery.order("suppressed_on_boards_browse", { ascending: true })
    }
    dbQuery = dbQuery.order("created_at", { ascending: false })
  }

  if (params.geoBbox) {
    const { minLat, maxLat, minLng, maxLng } = geoBoundingBoxFiltersMiles(
      params.geoBbox.lat,
      params.geoBbox.lng,
      params.geoBbox.radiusMiles,
    )
    dbQuery = dbQuery
      .gte("latitude", minLat)
      .lte("latitude", maxLat)
      .gte("longitude", minLng)
      .lte("longitude", maxLng)
  }

  if (params.rangeBeforeKeywordOr) {
    dbQuery = dbQuery.range(params.rangeBeforeKeywordOr.from, params.rangeBeforeKeywordOr.to)
  }

  if (params.pagedSort) {
    if (params.useSuppressionSort) {
      dbQuery = dbQuery.order("suppressed_on_boards_browse", { ascending: true })
    }
    const s = params.pagedSort
    if (s === "price-low") {
      dbQuery = dbQuery.order("price", { ascending: true })
    } else if (s === "price-high") {
      dbQuery = dbQuery.order("price", { ascending: false, nullsFirst: false })
    } else if (s === "price-newest") {
      dbQuery = dbQuery
        .order("price", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
    } else {
      dbQuery = dbQuery.order("created_at", { ascending: false })
    }
  }

  if (params.pagedRange) {
    dbQuery = dbQuery.range(params.pagedRange.from, params.pagedRange.to)
  }

  const loc = params.locationTextFilter?.trim()
  if (loc) {
    dbQuery = applyListingsLocationTextFilter(dbQuery, loc)
  }

  const brandModelIdFilter = params.brandModelId?.trim()
  const brandIdFilter = params.brandId?.trim()

  if (brandModelIdFilter && isUuidString(brandModelIdFilter)) {
    dbQuery = dbQuery.eq("brand_model_id", brandModelIdFilter)
  } else if (brandIdFilter && isUuidString(brandIdFilter)) {
    dbQuery = dbQuery.eq("brand_id", brandIdFilter)
  } else {
    const brandFilter = params.brand?.trim()
    if (brandFilter) {
      dbQuery = dbQuery.ilike("brand", `%${brandFilter}%`)
    }
    const modelFilter = params.model?.trim()
    if (modelFilter) {
      const pat = ilikeContainsPattern(modelFilter)
      dbQuery = dbQuery.or(`model.ilike.${pat},title.ilike.${pat}`)
    }
  }

  const dimensionTokens = boardDimensionBrowseIlikeTokens(
    params.dimensionFields ??
      boardDimensionBrowseFieldsFromSearchParams({
        legacyDimensions: params.legacyDimensions,
      }),
  )
  for (const token of dimensionTokens) {
    dbQuery = dbQuery.ilike("dimensions", `%${token}%`)
  }

  if (params.query) {
    const escaped = params.query.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
    const pattern = `"%${escaped}%"`
    const { data: matchingCats } = await supabase
      .from("categories")
      .select("id")
      .eq("board", true)
      .or(`name.ilike.${pattern},slug.ilike.${pattern}`)
    const categoryIds = (matchingCats ?? []).map((c) => c.id)
    const orParts = [
      `title.ilike.${pattern}`,
      `description.ilike.${pattern}`,
      `brand.ilike.${pattern}`,
      `fins_setup.ilike.${pattern}`,
      `tail_shape.ilike.${pattern}`,
    ]
    if (categoryIds.length > 0) orParts.push(`category_id.in.(${categoryIds.join(",")})`)
    dbQuery = dbQuery.or(orParts.join(","))
  }

  return dbQuery
}

/**
 * Geodistance search: no city/state text filter — uses listing lat/lng only.
 * Results sorted nearest-first; capped at `radiusCapMi` miles from anchor.
 */
export async function fetchNearestSurfboardsWithinRadius(params: {
  supabase: SupabaseClient
  anchorLat: number
  anchorLng: number
  radiusCapMi: number
  boardType: string
  condition: string
  query: string
  brand?: string
  model?: string
  brandId?: string
  brandModelId?: string
  dimensionFields?: BoardDimensionBrowseFields
  legacyDimensions?: string
  minPrice?: number
  maxPrice?: number
  offset: number
  limit: number
  maxFetch: number
  useSuppressionSort?: boolean
}) {
  let dbQuery = (await buildSurfboardBrowseBaseQuery(params.supabase, {
    boardType: params.boardType,
    condition: params.condition,
    query: params.query,
    brand: params.brand,
    model: params.model,
    brandId: params.brandId,
    brandModelId: params.brandModelId,
    dimensionFields: params.dimensionFields,
    legacyDimensions: params.legacyDimensions,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
    useSuppressionSort: params.useSuppressionSort,
    geoBbox: {
      lat: params.anchorLat,
      lng: params.anchorLng,
      radiusMiles: params.radiusCapMi,
    },
    rangeBeforeKeywordOr: { from: 0, to: params.maxFetch - 1 },
    prependCreatedAtOrder: true,
  })) as unknown as SurfboardBrowseListingsQuery

  const { data: rawBoards } = await dbQuery

  type Row = BoardBrowseListingRow & { _distance: number }

  let rows: Row[] = (rawBoards || []).map((b) => {
    const row = b as BoardBrowseListingRow
    return {
      ...row,
      _distance: haversineMi(params.anchorLat, params.anchorLng, row.latitude, row.longitude),
    }
  })
  rows = rows.filter((b) => b._distance <= params.radiusCapMi)
  rows.sort((a, b) => a._distance - b._distance)
  const totalPages =
    rows.length === 0 ? 0 : Math.max(1, Math.ceil(rows.length / params.limit))
  const boards = rows.slice(params.offset, params.offset + params.limit)
  return { boards, totalPages }
}

function hasNonEmptyParam(value: string | undefined): boolean {
  return Boolean(value?.trim())
}

/**
 * Nav pill views: `/boards` and `/boards?type=…` with optional condition, sort, and `page`
 * — no search, brand, geo, dimension, or price filters.
 */
export function isBoardsBrowseCategoryTypeView(sp: BoardsBrowseSearchParams): boolean {
  if (hasNonEmptyParam(sp.q)) return false
  if (hasNonEmptyParam(sp.brand)) return false
  if (hasNonEmptyParam(sp.model)) return false
  if (hasNonEmptyParam(sp.brandId)) return false
  if (hasNonEmptyParam(sp.brandModelId)) return false
  if (hasNonEmptyParam(sp.location)) return false
  if (hasNonEmptyParam(sp.minPrice)) return false
  if (hasNonEmptyParam(sp.maxPrice)) return false
  if (hasNonEmptyParam(sp.radius)) return false
  if (hasNonEmptyParam(sp.lat)) return false
  if (hasNonEmptyParam(sp.lng)) return false
  if (hasNonEmptyParam(sp.dimensions)) return false
  if (hasNonEmptyParam(sp.dimLength)) return false
  if (hasNonEmptyParam(sp.dimWidth)) return false
  if (hasNonEmptyParam(sp.dimThickness)) return false
  if (hasNonEmptyParam(sp.dimVolume)) return false

  const page = parseInt(sp.page || "1", 10)
  if (!Number.isFinite(page) || page < 1) return false

  return true
}

export function boardsBrowseCategoryTypeCacheKey(sp: BoardsBrowseSearchParams): {
  boardType: string
  condition: string
  sort: string
  page: number
} {
  const normalizedType = normalizedBoardsBrowseTypeFromParam(sp.type)
  const boardType = normalizedType ?? "all"
  const condition = sp.condition?.trim() || "all"
  const sort = sp.sort || BOARDS_BROWSE_DEFAULT_SORT
  const page = parseInt(sp.page || "1", 10)
  return {
    boardType,
    condition,
    sort,
    page: Number.isFinite(page) && page >= 1 ? page : 1,
  }
}

export type BoardsBrowseCategoryTypePage = {
  boards: BoardBrowseListingRow[]
  totalPages: number
}

/** Default sort, no text/geo/brand filters — used by nav category pills and hourly cache. */
export async function fetchBoardsBrowseCategoryTypePage(
  supabase: SupabaseClient,
  params: { boardType: string; condition: string; sort: string; page: number },
): Promise<BoardsBrowseCategoryTypePage> {
  const limit = BOARDS_BROWSE_PAGE_SIZE
  const offset = (params.page - 1) * limit
  let useSuppressionSort = await isBoardsBrowseSuppressionSortAvailable(supabase)

  let listingsChain = (await buildSurfboardBrowseBaseQuery(supabase, {
    boardType: params.boardType,
    condition: params.condition,
    query: "",
    useSuppressionSort,
    pagedSort: params.sort,
    pagedRange: { from: offset, to: offset + limit - 1 },
  })) as unknown as SurfboardBrowseListingsQuery

  let { data: rawBoards, count, error } = await listingsChain

  if (error && useSuppressionSort) {
    console.error("fetchBoardsBrowseCategoryTypePage (suppression sort):", error.message)
    useSuppressionSort = false
    listingsChain = (await buildSurfboardBrowseBaseQuery(supabase, {
      boardType: params.boardType,
      condition: params.condition,
      query: "",
      useSuppressionSort: false,
      pagedSort: params.sort,
      pagedRange: { from: offset, to: offset + limit - 1 },
    })) as unknown as SurfboardBrowseListingsQuery
    ;({ data: rawBoards, count, error } = await listingsChain)
  }

  if (error) {
    console.error("fetchBoardsBrowseCategoryTypePage:", error.message)
  }

  return {
    boards: (rawBoards ?? []) as BoardBrowseListingRow[],
    totalPages: Math.ceil((count || 0) / limit),
  }
}
