import { Suspense, type ReactNode } from "react"
import { redirect } from "next/navigation"
import { BoardsBrowsePagination } from "@/components/boards-browse-pagination"
import { ListingTileGridSkeleton } from "@/components/listing-tile-skeleton"
import { ListYourSurfboardMarketplaceReviewsSection } from "@/components/features/marketing/list-your-surfboard-buyer-reviews-section"
import type { MarketplaceShowcaseReviewRow } from "@/lib/db/marketplace-reviews-showcase"
import { CategoryBrowseBreadcrumbs } from "@/components/category-browse-breadcrumbs"
import { BoardsBrowseAdminCurator } from "@/components/boards-browse-admin-curator"

import { getCachedRequestSession } from "@/lib/auth/cached-request-session"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"
import { BoardsBrowseClient } from "@/components/boards-browse-client"
import {
  CategoryTopShopsSection,
  CategoryTopShopsSectionSkeleton,
} from "@/components/features/browse/category-top-shops-section"
import { BoardsNoResultsSaveSearch } from "@/components/boards-no-results-save-search"
import { boardSavedSearchCriteriaFromFilters } from "@/lib/utils/board-saved-search-criteria"
import { BoardsBrowseJsonLd } from "@/components/features/marketplace/boards-browse-json-ld"
import { BoardsBrowseFiltersSectionSkeleton } from "@/components/boards-browse-page-skeleton"
import { getBoardsBrowseCategoryTypePageCached } from "@/lib/cache/boards-browse-catalog"
import { getBoardsBrowseFacetCountsMapCached } from "@/lib/cache/boards-browse-facet-counts"
import { HomePeerListingScrollTile } from "@/components/features/home/home-peer-listing-scroll-tile"
import { isBoardsBrowseSuppressionSortAvailable } from "@/lib/db/boards-browse-suppressed-admin"
import {
  BOARDS_BROWSE_PAGE_SIZE,
  buildSurfboardBrowseBaseQuery,
  compareBoardBrowseRows,
  compareBoardBrowseRowsDailyRotate,
  fetchBoardsBrowseDailyRotatePage,
  fetchNearestSurfboardsWithinRadius,
  isBoardsBrowseTopPicksSort,
  LOCATION_FALLBACK_RADIUS_MI,
  LOCATION_FALLBACK_WIDE_RADIUS_MI,
  suppressedBrowseRank,
  type BoardBrowseListingRow,
  type SurfboardBrowseListingsQuery,
} from "@/lib/db/boards-browse-listings"
import {
  boardsBrowseBoardTypeLabel,
  BOARDS_BROWSE_DEFAULT_SORT,
  isBoardsBrowseShippingAvailableParam,
  type BoardsBrowseSearchParams,
} from "@/lib/marketplace-slug-metadata"
import { forwardGeocodePlaceForServer } from "@/lib/maps/forward-geocode-server"
import {
  boardDimensionBrowseFieldsFromSearchParams,
  boardDimensionBrowseIlikeTokens,
} from "@/lib/utils/board-dimension-browse-filter"
import {
  getBoardsBrowseListingsPageViaEs,
  isBoardsBrowseEsEnabled,
} from "@/lib/db/boards-browse-listings-es"
import {
  mergeNlOverlayIntoFacets,
  resolveBoardsSearchQuery,
} from "@/lib/services/searchBoards"
import {
  newSearchQualityEventId,
  scheduleSearchQualityEventCapture,
} from "@/lib/services/searchQuality"
import { NaturalLanguageSearchHelper } from "@/components/features/search/natural-language-search-helper"
import { surfboardsBrowseRootLabel } from "@/lib/site-category-directory"
import { cn } from "@/lib/utils"
import { isUuidString } from "@/lib/utils/isUuid"
import { haversineMi } from "@/lib/db/boards-browse-listings"
import { boardsBrowseDailyRotateSeed } from "@/lib/utils/boards-browse-daily-rotate"
import { facetSelectionsFromBrowseParams } from "@/lib/boards-browse-facets"
import {
  boardsBrowseEffectiveSort,
  boardsBrowseHasSidebarFilters,
} from "@/lib/boards-browse-sidebar-filters"
import { getOpenBoardsGiveaway } from "@/lib/giveaways/boards-enter-props"
import type { BoardsGiveawayEnterProps } from "@/components/features/giveaways/boards-giveaway-enter-button"

async function BoardsBrowseAdminCuratorGate() {
  const { supabase, user } = await getCachedRequestSession()
  if (!user) return null
  const { data: profile } = await supabase
    .from("profiles")
    .select("is_admin")
    .eq("id", user.id)
    .maybeSingle()
  return (
    <BoardsBrowseAdminCurator
      isAdmin={profile?.is_admin === true}
      className="border-white/55 bg-white/95 text-[#001A4A] shadow-sm hover:bg-white"
    />
  )
}

async function BoardsBrowseFiltersSection({
  searchParams: searchParamsPromise,
  children,
  title,
  description,
  headerAction,
  giveawayEnter = null,
}: {
  searchParams: Promise<BoardsBrowseSearchParams>
  children: ReactNode
  title?: string
  description?: string
  headerAction?: ReactNode
  giveawayEnter?: BoardsGiveawayEnterProps | null
}) {
  const searchParams = await searchParamsPromise
  const facetCounts = await getBoardsBrowseFacetCountsMapCached(searchParams)
  return (
    <BoardsBrowseClient
      counts={facetCounts}
      title={title}
      description={description}
      headerAction={headerAction}
      giveawayEnter={giveawayEnter}
    >
      {children}
    </BoardsBrowseClient>
  )
}

async function BoardListings({
  searchParams: searchParamsPromise,
}: {
  searchParams: Promise<BoardsBrowseSearchParams>
}) {
  const searchParams = await searchParamsPromise
  const supabase = createAnonSupabaseClient()
  const page = parseInt(searchParams.page || "1", 10)
  const limit = BOARDS_BROWSE_PAGE_SIZE
  const offset = (page - 1) * limit

  const cachedCategoryPage = await getBoardsBrowseCategoryTypePageCached(searchParams)

  const boardType = searchParams.type || "all"
  const condition = searchParams.condition || "all"
  const query = searchParams.q || ""
  const hasKeywordQuery = query.trim().length > 0
  const rawSort = searchParams.sort || BOARDS_BROWSE_DEFAULT_SORT
  const hasSidebarFilters = boardsBrowseHasSidebarFilters(searchParams)
  const sort = boardsBrowseEffectiveSort(rawSort, hasSidebarFilters, hasKeywordQuery)
  const brand = searchParams.brand || ""
  const model = searchParams.model || ""
  const brandIdRaw = searchParams.brandId?.trim() ?? ""
  const brandModelIdRaw = searchParams.brandModelId?.trim() ?? ""
  const brandIdForQuery = isUuidString(brandIdRaw) ? brandIdRaw : undefined
  const brandModelIdForQuery = isUuidString(brandModelIdRaw) ? brandModelIdRaw : undefined
  const dimensionFields = boardDimensionBrowseFieldsFromSearchParams({
    dimLength: searchParams.dimLength,
    dimWidth: searchParams.dimWidth,
    dimThickness: searchParams.dimThickness,
    dimVolume: searchParams.dimVolume,
    legacyDimensions: searchParams.dimensions,
  })
  const baseFacets = facetSelectionsFromBrowseParams(searchParams)
  const urlLocation = searchParams.location || ""
  const urlMinPrice = searchParams.minPrice ? Number(searchParams.minPrice) : undefined
  const urlMaxPrice = searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined
  const urlShipping = isBoardsBrowseShippingAvailableParam(searchParams.shipping)
    ? true
    : undefined
  const radiusMi = searchParams.radius ? Number(searchParams.radius) : undefined
  const lat = searchParams.lat ? Number(searchParams.lat) : undefined
  const lng = searchParams.lng ? Number(searchParams.lng) : undefined
  const geoBrowseMaxRows = 500

  const hasLatLng = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)
  const hasRadius = radiusMi != null && !Number.isNaN(radiusMi) && radiusMi > 0
  const filterByRadius = hasLatLng && hasRadius
  const isNearestSort = sort === "nearest" && hasLatLng

  const useGeocodedAnchor = hasLatLng && (filterByRadius || isNearestSort)

  const isTopPicksSort = isBoardsBrowseTopPicksSort(sort)

  let boards: Awaited<ReturnType<ReturnType<typeof supabase.from>["select"]>>["data"] = null
  let totalPages = 0
  let handledByEs = false
  const esEnabled = isBoardsBrowseEsEnabled()
  const resolvedKeyword = hasKeywordQuery
    ? await resolveBoardsSearchQuery(supabase, {
        q: query,
        brandId: brandIdForQuery,
        brandModelId: brandModelIdForQuery,
        brand: brand.trim() || undefined,
        model: model.trim() || undefined,
      })
    : null

  const nl = resolvedKeyword?.nl ?? null
  const facets = mergeNlOverlayIntoFacets(baseFacets, nl)
  const location = urlLocation.trim() || nl?.locationText || ""
  const minPrice =
    urlMinPrice != null && !Number.isNaN(urlMinPrice) ? urlMinPrice : nl?.minPrice
  const maxPrice =
    urlMaxPrice != null && !Number.isNaN(urlMaxPrice) ? urlMaxPrice : nl?.maxPrice
  const shippingAvailable = urlShipping ?? nl?.shippingAvailable

  // When resolve ran, honor its keyword (including "none") — never fall back to the raw
  // URL `q`. Falling back re-introduces filter words ("under", "$800") into ES `must`
  // and zeros out brand/price results via minimum_should_match.
  const esQuery = resolvedKeyword
    ? resolvedKeyword.context.query
    : hasKeywordQuery
      ? query
      : undefined
  const esRankQuery = resolvedKeyword?.context.rankQuery
  const esBrandModelIds =
    resolvedKeyword?.context.brandModelIds ??
    (brandModelIdForQuery ? [brandModelIdForQuery] : undefined)
  const esBrandModelId =
    esBrandModelIds?.length === 1
      ? esBrandModelIds[0]
      : resolvedKeyword?.context.brandModelId ?? brandModelIdForQuery
  const esBrandId =
    esBrandModelIds?.length || esBrandModelId
      ? undefined
      : resolvedKeyword?.context.brandId ?? brandIdForQuery
  const esBrand =
    resolvedKeyword?.context.brand ??
    (esBrandModelId || esBrandModelIds?.length ? undefined : brand.trim() || undefined)
  const esModel =
    resolvedKeyword?.context.model ??
    (esBrandModelId || esBrandModelIds?.length || esBrandId
      ? undefined
      : model.trim() || undefined)
  const esExpansions = resolvedKeyword?.context.expansions
  const esLengthInches = resolvedKeyword?.context.lengthInches
  const esMinLengthInches = resolvedKeyword?.context.minLengthInches
  const esMaxLengthInches = resolvedKeyword?.context.maxLengthInches
  const esTailShapes = resolvedKeyword?.context.tailShapes
  // Structured keyword resolution counts as a locked keyword search (no PG ILIKE fallthrough).
  const hasStructuredKeyword = Boolean(
    hasKeywordQuery ||
      esBrandModelId ||
      (esBrandModelIds?.length ?? 0) > 0 ||
      esBrandId ||
      esLengthInches != null ||
      esMinLengthInches != null ||
      esMaxLengthInches != null ||
      (esTailShapes?.length ?? 0) > 0 ||
      Boolean(nl),
  )

  const searchParamsString = new URLSearchParams(
    Object.entries(searchParams).flatMap(([key, value]) => {
      if (typeof value !== "string" || !value.trim()) return []
      return [[key, value] as [string, string]]
    }),
  ).toString()

  const searchQualityEventId = hasKeywordQuery ? newSearchQualityEventId() : null

  const nlHint =
    hasKeywordQuery ? (
      <div className="mb-4">
        <NaturalLanguageSearchHelper
          query={query}
          searchParamsString={searchParamsString}
          initialAppliedLabels={nl?.appliedLabels}
          initialSummary={nl?.summary}
          qualityEventId={searchQualityEventId}
        />
      </div>
    ) : null

  // Elasticsearch: indexed filtering + geo_distance sort on reswell_listings (surfboards).
  // Nav category views stay on the (cheap, hourly-cached) Postgres path. Keyword search
  // never falls through to Postgres ILIKE when ES is configured.
  if (!cachedCategoryPage && esEnabled) {
    try {
      const esBrowseInput = {
        boardType,
        condition,
        query: esQuery,
        rankQuery: esRankQuery,
        brand: esBrandModelIds?.length || esBrandModelId ? undefined : esBrand,
        model:
          esBrandModelIds?.length || esBrandModelId || esBrandId ? undefined : esModel,
        brandId: esBrandModelIds?.length || esBrandModelId ? undefined : esBrandId,
        brandModelId: esBrandModelId,
        brandModelIds: esBrandModelIds,
        expansions: esExpansions,
        lengthInches: esLengthInches,
        minLengthInches: esMinLengthInches,
        maxLengthInches: esMaxLengthInches,
        tailShapes: esTailShapes,
        dimensionTokens: boardDimensionBrowseIlikeTokens(dimensionFields),
        facets,
        minPrice,
        maxPrice,
        shippingAvailable,
        locationText: location.trim() && !useGeocodedAnchor ? location : undefined,
        geo:
          hasLatLng && (filterByRadius || isNearestSort)
            ? { lat: lat!, lng: lng!, radiusMi: filterByRadius ? radiusMi : undefined }
            : undefined,
        sort,
        page,
      } as const

      let esPage = await getBoardsBrowseListingsPageViaEs(supabase, esBrowseInput)
      // Length from free-text is a hint — if it zeros out results, retry without it.
      if (
        esPage &&
        esPage.boards.length === 0 &&
        esLengthInches != null &&
        (hasKeywordQuery || (esBrandModelIds?.length ?? 0) > 0)
      ) {
        esPage = await getBoardsBrowseListingsPageViaEs(supabase, {
          ...esBrowseInput,
          lengthInches: undefined,
        })
      }
      if (esPage) {
        boards = esPage.boards
        totalPages = esPage.totalPages
        handledByEs = true
      } else if (hasStructuredKeyword) {
        boards = []
        totalPages = 0
        handledByEs = true
      }
    } catch (e) {
      console.error("BoardListings ES browse failed:", e)
      if (hasStructuredKeyword) {
        boards = []
        totalPages = 0
        handledByEs = true
      }
    }
  }

  if (handledByEs) {
    // boards + totalPages populated by Elasticsearch above.
  } else if (cachedCategoryPage) {
    boards = cachedCategoryPage.boards
    totalPages = cachedCategoryPage.totalPages
  } else if (isTopPicksSort && !filterByRadius && !isNearestSort) {
    const rotatePage = await fetchBoardsBrowseDailyRotatePage(supabase, {
      boardType,
      condition,
      page,
    })
    boards = rotatePage.boards
    totalPages = rotatePage.totalPages
  } else {
    const useSuppressionSort = await isBoardsBrowseSuppressionSortAvailable(supabase)

    let listingsChain = (await buildSurfboardBrowseBaseQuery(supabase, {
      boardType,
      condition,
      query,
      brand: brandModelIdForQuery ? undefined : brand.trim() || undefined,
      model: brandModelIdForQuery || brandIdForQuery ? undefined : model.trim() || undefined,
      brandId: brandModelIdForQuery ? undefined : brandIdForQuery,
      brandModelId: brandModelIdForQuery,
      dimensionFields,
      facets,
      minPrice,
      maxPrice,
      shippingAvailable,
      useSuppressionSort,
      geoBbox:
        filterByRadius && hasLatLng
          ? { lat: lat!, lng: lng!, radiusMiles: radiusMi! }
          : undefined,
      rangeBeforeKeywordOr:
        filterByRadius || isNearestSort
          ? { from: 0, to: geoBrowseMaxRows - 1 }
          : undefined,
      prependCreatedAtOrder: filterByRadius || isNearestSort,
      pagedSort: filterByRadius || isNearestSort ? undefined : sort,
      pagedRange:
        filterByRadius || isNearestSort
          ? undefined
          : { from: offset, to: offset + limit - 1 },
      locationTextFilter:
        location.trim() && !useGeocodedAnchor ? location : undefined,
    })) as unknown as SurfboardBrowseListingsQuery

    /**
     * When the user has a geocoded point and is searching by distance (radius or nearest),
     * the anchor is lat/lng — do not also require `city`/`state` to match the geocoder label,
     * or valid nearby listings are dropped before distance runs.
     */
    if (filterByRadius || isNearestSort) {
      const geoChain = listingsChain
      const { data: rawBoards } = await geoChain
      type GeoListingRow = BoardBrowseListingRow & { _distance: number }
      let withDistance: GeoListingRow[] = (rawBoards || []).map((b) => {
        const row = b as BoardBrowseListingRow
        return {
          ...row,
          _distance: haversineMi(lat!, lng!, row.latitude, row.longitude),
        }
      })
      if (filterByRadius) {
        withDistance = withDistance.filter((b) => b._distance <= radiusMi!)
      }
      if (isNearestSort) {
        withDistance.sort((a, b) => {
          const supDiff = suppressedBrowseRank(a) - suppressedBrowseRank(b)
          if (supDiff !== 0) return supDiff
          return a._distance - b._distance
        })
      } else if (isTopPicksSort) {
        const rotateSeed = boardsBrowseDailyRotateSeed()
        withDistance.sort((a, b) => compareBoardBrowseRowsDailyRotate(a, b, rotateSeed))
      } else {
        withDistance.sort((a, b) => compareBoardBrowseRows(a, b, sort))
      }
      totalPages = Math.ceil(withDistance.length / limit)
      boards = withDistance.slice(offset, offset + limit)
    } else {
      let { data: rawBoards, count, error } = await listingsChain

      if (error && useSuppressionSort) {
        console.error("BoardListings browse query (suppression sort):", error.message)
        listingsChain = (await buildSurfboardBrowseBaseQuery(supabase, {
          boardType,
          condition,
          query,
          brand: brandModelIdForQuery ? undefined : brand.trim() || undefined,
          model: brandModelIdForQuery || brandIdForQuery ? undefined : model.trim() || undefined,
          brandId: brandModelIdForQuery ? undefined : brandIdForQuery,
          brandModelId: brandModelIdForQuery,
          dimensionFields,
          facets,
          minPrice,
          maxPrice,
          shippingAvailable,
          useSuppressionSort: false,
          geoBbox:
            filterByRadius && hasLatLng
              ? { lat: lat!, lng: lng!, radiusMiles: radiusMi! }
              : undefined,
          rangeBeforeKeywordOr:
            filterByRadius || isNearestSort
              ? { from: 0, to: geoBrowseMaxRows - 1 }
              : undefined,
          prependCreatedAtOrder: filterByRadius || isNearestSort,
          pagedSort: filterByRadius || isNearestSort ? undefined : sort,
          pagedRange:
            filterByRadius || isNearestSort
              ? undefined
              : { from: offset, to: offset + limit - 1 },
          locationTextFilter:
            location.trim() && !useGeocodedAnchor ? location : undefined,
        })) as unknown as SurfboardBrowseListingsQuery
        ;({ data: rawBoards, count, error } = await listingsChain)
      }

      if (error) {
        console.error("BoardListings browse query:", error.message)
      }

      boards = rawBoards

      totalPages = Math.ceil((count || 0) / limit)
    }
  }

  let locationFallbackNotice: string | null = null

  if (!cachedCategoryPage && (!boards || boards.length === 0)) {
    let anchorLat: number | undefined = hasLatLng ? lat! : undefined
    let anchorLng: number | undefined = hasLatLng ? lng! : undefined

    const geocodedForFallback =
      (anchorLat == null ||
        anchorLng == null ||
        Number.isNaN(anchorLat) ||
        Number.isNaN(anchorLng)) &&
      location.trim().length >= 2

    if (geocodedForFallback) {
      const g = await forwardGeocodePlaceForServer(location.trim())
      if (g) {
        anchorLat = g.lat
        anchorLng = g.lng
      }
    }

    const canTryNearbyFallback =
      anchorLat != null &&
      anchorLng != null &&
      !Number.isNaN(anchorLat) &&
      !Number.isNaN(anchorLng)

    if (canTryNearbyFallback) {
      const alat = anchorLat!
      const alng = anchorLng!

      const nearbyBrand = brandModelIdForQuery ? undefined : brand.trim() || undefined
      const nearbyModel =
        brandModelIdForQuery || brandIdForQuery ? undefined : model.trim() || undefined

      async function fetchNearbyRadiusEs(radiusCapMi: number, q: string) {
        const pageResult = await getBoardsBrowseListingsPageViaEs(supabase, {
          boardType,
          condition,
          query: q || esQuery,
          brand:
            nearbyBrand ??
            (esBrandModelIds?.length || esBrandModelId ? undefined : esBrand),
          model:
            nearbyModel ??
            (esBrandModelIds?.length || esBrandModelId || esBrandId ? undefined : esModel),
          brandId: esBrandModelIds?.length || esBrandModelId ? undefined : esBrandId,
          brandModelId: esBrandModelId,
          brandModelIds: esBrandModelIds,
          expansions: esExpansions,
          lengthInches: esLengthInches,
          minLengthInches: esMinLengthInches,
          maxLengthInches: esMaxLengthInches,
          tailShapes: esTailShapes,
          dimensionTokens: boardDimensionBrowseIlikeTokens(dimensionFields),
          facets,
          minPrice,
          maxPrice,
          shippingAvailable,
          geo: { lat: alat, lng: alng, radiusMi: radiusCapMi },
          sort: "nearest",
          page,
        })
        return pageResult ?? { boards: [] as BoardBrowseListingRow[], totalPages: 0 }
      }

      async function fetchNearbyRadiusPg(radiusCapMi: number, q: string) {
        const useSuppressionSort = await isBoardsBrowseSuppressionSortAvailable(supabase)
        return fetchNearestSurfboardsWithinRadius({
          supabase,
          anchorLat: alat,
          anchorLng: alng,
          radiusCapMi,
          boardType,
          condition,
          query: q,
          brand: nearbyBrand,
          model: nearbyModel,
          brandId: brandModelIdForQuery ? undefined : brandIdForQuery,
          brandModelId: brandModelIdForQuery,
          dimensionFields,
          facets,
          minPrice,
          maxPrice,
          shippingAvailable,
          offset,
          limit,
          maxFetch: radiusCapMi >= LOCATION_FALLBACK_WIDE_RADIUS_MI ? 4000 : 2500,
          useSuppressionSort,
        })
      }

      async function fetchNearbyRadius(radiusCapMi: number, q: string) {
        // When ES is on, widen via the listings index — never Postgres ILIKE for nearby search.
        if (esEnabled) return fetchNearbyRadiusEs(radiusCapMi, q)
        return fetchNearbyRadiusPg(radiusCapMi, q)
      }

      const try100MiFirst =
        !filterByRadius ||
        radiusMi == null ||
        radiusMi < LOCATION_FALLBACK_RADIUS_MI

      if (try100MiFirst) {
        let fb = await fetchNearbyRadius(LOCATION_FALLBACK_RADIUS_MI, query)
        let widenedKeyword = false
        if (fb.boards.length === 0 && query.trim()) {
          fb = await fetchNearbyRadius(LOCATION_FALLBACK_RADIUS_MI, "")
          widenedKeyword = true
        }
        if (fb.boards.length > 0) {
          boards = fb.boards
          totalPages = fb.totalPages
          if (widenedKeyword) {
            locationFallbackNotice =
              "No exact matches for your search in this area — showing the nearest surfboards within 100 miles."
          } else if (filterByRadius && radiusMi != null && radiusMi < LOCATION_FALLBACK_RADIUS_MI) {
            locationFallbackNotice = `No boards within ${Math.round(radiusMi)} mi — showing the nearest listings within ${LOCATION_FALLBACK_RADIUS_MI} miles.`
          } else if (geocodedForFallback) {
            locationFallbackNotice = `No listings right in that area — showing the nearest surfboards within ${LOCATION_FALLBACK_RADIUS_MI} miles.`
          } else {
            locationFallbackNotice =
              "No listings matched that closely — showing the nearest surfboards within 100 miles."
          }
        }
      }

      if ((!boards || boards.length === 0) && !locationFallbackNotice) {
        let fbWide = await fetchNearbyRadius(LOCATION_FALLBACK_WIDE_RADIUS_MI, query)
        let widenedKeywordWide = false
        if (fbWide.boards.length === 0 && query.trim()) {
          fbWide = await fetchNearbyRadius(LOCATION_FALLBACK_WIDE_RADIUS_MI, "")
          widenedKeywordWide = true
        }
        if (fbWide.boards.length > 0) {
          boards = fbWide.boards
          totalPages = fbWide.totalPages
          if (widenedKeywordWide) {
            locationFallbackNotice =
              "No exact matches in this region — showing the closest listings we have (sorted by distance)."
          } else if (filterByRadius && radiusMi != null && radiusMi >= LOCATION_FALLBACK_RADIUS_MI) {
            locationFallbackNotice = `No boards within ${Math.round(radiusMi)} mi — showing the closest listings we have (sorted by distance).`
          } else {
            locationFallbackNotice =
              "No boards within 100 miles with those filters — showing the closest listings we have (sorted by distance)."
          }
        }
      }
    }
  }

  if (searchQualityEventId && hasKeywordQuery) {
    const rows = (boards ?? []) as BoardBrowseListingRow[]
    scheduleSearchQualityEventCapture({
      eventId: searchQualityEventId,
      rawQuery: query,
      searchSurface: "boards",
      backend: handledByEs ? "elasticsearch" : "supabase",
      listings: rows.map((row) => ({
        id: row.id,
        title: row.title,
        slug: row.slug,
        price: row.price,
        board_type: row.board_type,
        listing_images: row.listing_images,
      })),
      parsed: resolvedKeyword?.parsed ?? null,
      extraStyles: nl?.styles ?? [],
    })
  }

  if (!boards || boards.length === 0) {
    const saveCriteria = boardSavedSearchCriteriaFromFilters({
      q: query,
      brand,
      model,
      catalogBrandId: brandIdRaw,
      catalogBrandModelId: brandModelIdRaw,
      boardLength: searchParams.dimLength ?? "",
      boardWidthInches: searchParams.dimWidth ?? "",
      boardThicknessInches: searchParams.dimThickness ?? "",
      boardVolumeL: searchParams.dimVolume ?? "",
      minPrice: searchParams.minPrice ?? "",
      maxPrice: searchParams.maxPrice ?? "",
      type: boardType,
      condition,
      sort,
      facets,
      shipping: searchParams.shipping,
    })
    const { user } = await getCachedRequestSession()

    return (
      <>
        {nlHint}
        <BoardsNoResultsSaveSearch
          criteria={saveCriteria}
          isLoggedIn={Boolean(user)}
          clearHref="/boards"
        />
      </>
    )
  }

  const boardRows = boards as BoardBrowseListingRow[]

  return (
    <>
      {nlHint}
      {locationFallbackNotice ? (
        <p
          className="mb-4 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground"
          role="status"
        >
          {locationFallbackNotice}
        </p>
      ) : null}
      <Suspense
        fallback={
          <BoardListingsTileGrid
            boardRows={boardRows}
            favoritedIds={[]}
            userId={null}
          />
        }
      >
        <BoardListingsTileGridWithFavorites boardRows={boardRows} />
      </Suspense>

      <BoardsBrowsePagination page={page} totalPages={totalPages} />
    </>
  )
}

function BoardListingsTileGrid({
  boardRows,
  favoritedIds,
  userId,
}: {
  boardRows: BoardBrowseListingRow[]
  favoritedIds: string[]
  userId: string | null
}) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {boardRows.map((board, tileIdx) => (
        <HomePeerListingScrollTile
          key={board.id}
          layout="grid"
          userId={userId}
          isFavorited={favoritedIds.includes(board.id)}
          imagePriority={tileIdx < 2}
          listing={{
            id: board.id,
            slug: board.slug,
            user_id: board.user_id,
            title: board.title,
            price: board.price,
            compare_at_price: board.compare_at_price,
            status: board.status,
            section: "surfboards",
            local_pickup: board.local_pickup,
            shipping_available: board.shipping_available,
            listing_images: board.listing_images,
            categories: board.categories,
            board_type: board.board_type,
            condition: board.condition,
          }}
        />
      ))}
    </div>
  )
}

async function BoardListingsTileGridWithFavorites({
  boardRows,
}: {
  boardRows: BoardBrowseListingRow[]
}) {
  const { supabase, user } = await getCachedRequestSession()

  let favoritedIds: string[] = []
  if (user && boardRows.length > 0) {
    const { data: favs } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .in(
        "listing_id",
        boardRows.map((b) => b.id),
      )
    favoritedIds = (favs ?? []).map((f) => f.listing_id)
  }

  return (
    <BoardListingsTileGrid
      boardRows={boardRows}
      favoritedIds={favoritedIds}
      userId={user?.id ?? null}
    />
  )
}

export async function BoardsBrowsePage(props: {
  searchParams: Promise<BoardsBrowseSearchParams>
  showListYourSurfboardCta?: boolean
  /** When `sort` is omitted from the URL, listings use this value. */
  defaultSort?: string
  topMarketplaceReviews?: MarketplaceShowcaseReviewRow[]
  heroListingImages?: readonly string[]
}) {
  const rawSearchParams = await props.searchParams
  const pageDefaultSort = props.defaultSort ?? BOARDS_BROWSE_DEFAULT_SORT
  const searchParams: BoardsBrowseSearchParams = {
    ...rawSearchParams,
    sort: rawSearchParams.sort?.trim() || pageDefaultSort,
  }
  const searchParamsPromise = Promise.resolve(searchParams)
  if (searchParams.type === "foamie") {
    const next = new URLSearchParams()
    for (const [k, v] of Object.entries(searchParams)) {
      if (k === "type" || v == null || v === "") continue
      next.set(k, v)
    }
    redirect(next.toString() ? `/boards?${next.toString()}` : "/boards")
  }
  if (searchParams.type === "funboard") {
    const next = new URLSearchParams()
    for (const [k, v] of Object.entries(searchParams)) {
      if (v == null || v === "") continue
      if (k === "type") {
        next.set("type", "hybrid")
        continue
      }
      next.set(k, v)
    }
    redirect(`/boards?${next.toString()}`)
  }
  if (searchParams.type === "mid-length") {
    const next = new URLSearchParams()
    for (const [k, v] of Object.entries(searchParams)) {
      if (v == null || v === "") continue
      if (k === "type") {
        next.set("type", "hybrid")
        continue
      }
      next.set(k, v)
    }
    redirect(`/boards?${next.toString()}`)
  }
  if (searchParams.type === "step-up" || searchParams.type === "gun") {
    const next = new URLSearchParams()
    for (const [k, v] of Object.entries(searchParams)) {
      if (v == null || v === "") continue
      if (k === "type") {
        next.set("type", "step-up-gun")
        continue
      }
      next.set(k, v)
    }
    redirect(`/boards?${next.toString()}`)
  }
  const typeCrumb = boardsBrowseBoardTypeLabel(searchParams.type)
  const pageTitle = typeCrumb ?? surfboardsBrowseRootLabel
  const openGiveaway = props.showListYourSurfboardCta ? null : getOpenBoardsGiveaway()
  const giveawayEnter: BoardsGiveawayEnterProps | null = openGiveaway
    ? { giveaway: openGiveaway }
    : null

  return (
    <main className="flex-1">
      <BoardsBrowseJsonLd searchParams={searchParams} />
      {!props.showListYourSurfboardCta ? (
        <section className="bg-offwhite pt-1 sm:pt-2 lg:pt-6">
          <div className="container mx-auto">
            <div className="border-t border-neutral-200 pt-2 lg:pt-3">
              <CategoryBrowseBreadcrumbs
                rootHref="/boards"
                rootLabel={surfboardsBrowseRootLabel}
                searchParams={searchParams}
                segment={
                  typeCrumb && searchParams.type?.trim()
                    ? {
                        label: typeCrumb,
                        href: `/boards?type=${encodeURIComponent(searchParams.type.trim())}`,
                        ownedParamKeys: ["type"],
                      }
                    : undefined
                }
              />
            </div>
          </div>
        </section>
      ) : null}

      {props.showListYourSurfboardCta ? (
        <ListYourSurfboardMarketplaceReviewsSection
          reviews={props.topMarketplaceReviews ?? []}
          heroListingImages={props.heroListingImages ?? []}
        />
      ) : null}

      <section
        className={cn(
          "min-w-0 pb-4",
          props.showListYourSurfboardCta ? "pt-8 sm:pt-10" : "bg-offwhite pt-2 sm:pt-5",
        )}
      >
        <div className="container mx-auto min-w-0">
          {props.showListYourSurfboardCta ? (
            <h2 className="mb-4 text-center text-2xl font-bold tracking-tight text-foreground sm:mb-5">
              Browse all surfboards
            </h2>
          ) : null}
          <Suspense fallback={<BoardsBrowseFiltersSectionSkeleton showTitle={!props.showListYourSurfboardCta} />}>
            <BoardsBrowseFiltersSection
              searchParams={searchParamsPromise}
              title={props.showListYourSurfboardCta ? undefined : pageTitle}
              description={undefined}
              giveawayEnter={giveawayEnter}
              headerAction={
                props.showListYourSurfboardCta ? undefined : (
                  <Suspense fallback={null}>
                    <BoardsBrowseAdminCuratorGate />
                  </Suspense>
                )
              }
            >
              <Suspense fallback={<ListingTileGridSkeleton count={10} ariaLabel="Loading surfboards" />}>
                <BoardListings searchParams={searchParamsPromise} />
              </Suspense>
            </BoardsBrowseFiltersSection>
          </Suspense>
        </div>
      </section>

      <Suspense fallback={<CategoryTopShopsSectionSkeleton />}>
        <CategoryTopShopsSection section="surfboards" />
      </Suspense>
    </main>
  )
}
