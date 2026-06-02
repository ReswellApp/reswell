import { Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { ListingTileGridSkeleton } from "@/components/listing-tile-skeleton"
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb"
import { createClient } from "@/lib/supabase/server"
import { BoardsBrowseClient } from "@/components/boards-browse-client"
import { BoardsBrowseJsonLd } from "@/components/features/marketplace/boards-browse-json-ld"
import { getBoardsBrowseCategoryTypePageCached } from "@/lib/cache/boards-browse-catalog"
import { Users } from "lucide-react"
import { HomePeerListingScrollTile } from "@/components/features/home/home-peer-listing-scroll-tile"
import { BoardsBrowseAdminCurator } from "@/components/boards-browse-admin-curator"
import { isBoardsBrowseSuppressionSortAvailable } from "@/lib/db/boards-browse-suppressed-admin"
import {
  BOARDS_BROWSE_PAGE_SIZE,
  buildSurfboardBrowseBaseQuery,
  compareBoardBrowseRows,
  compareBoardBrowseRowsTopPicks,
  fetchBoardsBrowseTopPicksPage,
  fetchNearestSurfboardsWithinRadius,
  isBoardsBrowseTopPicksSort,
  LOCATION_FALLBACK_RADIUS_MI,
  LOCATION_FALLBACK_WIDE_RADIUS_MI,
  suppressedBrowseRank,
  type BoardBrowseListingRow,
  type SurfboardBrowseListingsQuery,
} from "@/lib/db/boards-browse-listings"
import { listBoardsBrowseTopPickListingIdsOrdered } from "@/lib/db/boards-browse-top-picks"
import {
  boardsBrowseBoardTypeLabel,
  boardsBrowseHeroSubtext,
  BOARDS_BROWSE_DEFAULT_SORT,
  type BoardsBrowseSearchParams,
} from "@/lib/marketplace-slug-metadata"
import { forwardGeocodePlaceForServer } from "@/lib/maps/forward-geocode-server"
import {
  boardDimensionBrowseFieldsFromSearchParams,
  appendBoardDimensionBrowseParams,
} from "@/lib/utils/board-dimension-browse-filter"
import {
  facetSelectionsFromParams,
  FACET_PARAM_KEYS,
} from "@/lib/boards-browse-facets"
import {
  getBoardsBrowseFacetCounts,
  facetCountsByParamKey,
} from "@/lib/services/boardsBrowseFacetCounts"
import { surfboardsBrowseRootLabel } from "@/lib/site-category-directory"
import { isUuidString } from "@/lib/utils/isUuid"
import { haversineMi } from "@/lib/db/boards-browse-listings"

async function BoardListings({ searchParams }: { searchParams: BoardsBrowseSearchParams }) {
  const supabase = await createClient()
  const page = parseInt(searchParams.page || "1")
  const limit = BOARDS_BROWSE_PAGE_SIZE
  const offset = (page - 1) * limit

  const cachedCategoryPage = await getBoardsBrowseCategoryTypePageCached(searchParams)

  const boardType = searchParams.type || "all"
  const condition = searchParams.condition || "all"
  const sort = searchParams.sort || BOARDS_BROWSE_DEFAULT_SORT
  const query = searchParams.q || ""
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
  const facets = facetSelectionsFromParams(searchParams)
  const location = searchParams.location || ""
  const minPrice = searchParams.minPrice ? Number(searchParams.minPrice) : undefined
  const maxPrice = searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined
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

  let boards: Awaited<ReturnType<ReturnType<typeof supabase.from>["select"]>>["data"]
  let totalPages: number

  if (cachedCategoryPage) {
    boards = cachedCategoryPage.boards
    totalPages = cachedCategoryPage.totalPages
  } else if (isTopPicksSort && !filterByRadius && !isNearestSort) {
    const topPicksPage = await fetchBoardsBrowseTopPicksPage(supabase, {
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
      locationTextFilter: location.trim() && !useGeocodedAnchor ? location : undefined,
      page,
    })
    boards = topPicksPage.boards
    totalPages = topPicksPage.totalPages
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
        const curatedIds = await listBoardsBrowseTopPickListingIdsOrdered(supabase)
        const curationIndex = new Map(curatedIds.map((id, index) => [id, index]))
        withDistance.sort((a, b) => compareBoardBrowseRowsTopPicks(a, b, curationIndex))
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
    const useSuppressionSort = await isBoardsBrowseSuppressionSortAvailable(supabase)

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

      async function fetchNearbyRadius(radiusCapMi: number, q: string) {
        return fetchNearestSurfboardsWithinRadius({
          supabase,
          anchorLat: alat,
          anchorLng: alng,
          radiusCapMi,
          boardType,
          condition,
          query: q,
          brand: brandModelIdForQuery ? undefined : brand.trim() || undefined,
          model: brandModelIdForQuery || brandIdForQuery ? undefined : model.trim() || undefined,
          brandId: brandModelIdForQuery ? undefined : brandIdForQuery,
          brandModelId: brandModelIdForQuery,
          dimensionFields,
          facets,
          minPrice,
          maxPrice,
          offset,
          limit,
          maxFetch: radiusCapMi >= LOCATION_FALLBACK_WIDE_RADIUS_MI ? 4000 : 2500,
          useSuppressionSort,
        })
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

  function pageUrl(pageNum: number) {
    const params = new URLSearchParams()
    if (searchParams.q) params.set("q", searchParams.q)
    if (searchParams.brand?.trim()) params.set("brand", searchParams.brand.trim())
    const pid = searchParams.brandId?.trim()
    if (pid && isUuidString(pid)) params.set("brandId", pid)
    if (searchParams.model?.trim()) params.set("model", searchParams.model.trim())
    const pmid = searchParams.brandModelId?.trim()
    if (pmid && isUuidString(pmid)) params.set("brandModelId", pmid)
    appendBoardDimensionBrowseParams(params, dimensionFields)
    if (searchParams.location) params.set("location", searchParams.location)
    if (searchParams.type && searchParams.type !== "all") params.set("type", searchParams.type)
    if (searchParams.condition && searchParams.condition !== "all")
      params.set("condition", searchParams.condition)
    for (const key of Object.values(FACET_PARAM_KEYS)) {
      if (key === FACET_PARAM_KEYS.condition) continue
      const val = searchParams[key]
      if (typeof val === "string" && val.trim()) params.set(key, val.trim())
    }
    if (searchParams.minPrice) params.set("minPrice", searchParams.minPrice)
    if (searchParams.maxPrice) params.set("maxPrice", searchParams.maxPrice)
    if (searchParams.radius) params.set("radius", searchParams.radius)
    if (searchParams.lat) params.set("lat", searchParams.lat)
    if (searchParams.lng) params.set("lng", searchParams.lng)
    if (searchParams.sort && searchParams.sort !== BOARDS_BROWSE_DEFAULT_SORT)
      params.set("sort", searchParams.sort)
    params.set("page", String(pageNum))
    return `/boards?${params.toString()}`
  }

  if (!boards || boards.length === 0) {
    return (
      <div className="text-center py-16">
        <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
        <p className="text-lg font-medium mb-2">No surfboards found</p>
        <p className="text-muted-foreground mb-4">Try adjusting your search or filters</p>
        <Button variant="outline" asChild>
          <Link href="/boards">Clear Filters</Link>
        </Button>
      </div>
    )
  }

  const boardRows = boards as BoardBrowseListingRow[]

  const {
    data: { user },
  } = await supabase.auth.getUser()
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
    <>
      {locationFallbackNotice ? (
        <p
          className="mb-4 rounded-lg border border-border bg-muted/50 px-4 py-3 text-sm text-muted-foreground"
          role="status"
        >
          {locationFallbackNotice}
        </p>
      ) : null}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {boardRows.map((board) => (
          <HomePeerListingScrollTile
            key={board.id}
            layout="grid"
            userId={user?.id ?? null}
            isFavorited={favoritedIds.includes(board.id)}
            listing={{
              id: board.id,
              slug: board.slug,
              user_id: board.user_id,
              title: board.title,
              price: board.price,
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

      {totalPages > 1 && (
        <div className="flex justify-center gap-2 mt-8">
          {page > 1 && (
            <Button variant="outline" asChild>
              <Link href={pageUrl(page - 1)}>Previous</Link>
            </Button>
          )}
          <span className="flex items-center px-4 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Button variant="outline" asChild>
              <Link href={pageUrl(page + 1)}>Next</Link>
            </Button>
          )}
        </div>
      )}
    </>
  )
}

export async function BoardsBrowsePage(props: {
  searchParams: Promise<BoardsBrowseSearchParams>
}) {
  const searchParams = await props.searchParams
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
  if (searchParams.type === "fish") {
    const next = new URLSearchParams()
    for (const [k, v] of Object.entries(searchParams)) {
      if (v == null || v === "") continue
      if (k === "type") {
        next.set("type", "groveler")
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

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  let isAdmin = false
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle()
    isAdmin = profile?.is_admin === true
  }

  const browseFacetSelections = facetSelectionsFromParams(searchParams)
  const facetCounts = facetCountsByParamKey(
    await getBoardsBrowseFacetCounts(
      supabase,
      {
        query: searchParams.q,
        brand: searchParams.brand,
        model: searchParams.model,
        brandId: searchParams.brandId,
        brandModelId: searchParams.brandModelId,
        minPrice: searchParams.minPrice ? Number(searchParams.minPrice) : undefined,
        maxPrice: searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined,
        location: searchParams.location,
      },
      browseFacetSelections,
    ),
  )

  return (
    <main className="flex-1">
      <BoardsBrowseJsonLd searchParams={searchParams} />
      <section className="bg-offwhite pt-6 pb-4 sm:pt-8 sm:pb-5">
        <div className="container mx-auto">
          <div className="border-t border-neutral-200 mb-4 pt-4">
            <Breadcrumb>
              <BreadcrumbList className="gap-1.5 text-sm font-normal text-[#5c6b89] sm:gap-2">
                <BreadcrumbItem>
                  <BreadcrumbLink asChild className="text-[#5c6b89] hover:text-[#4a5768]">
                    <Link href="/">Home</Link>
                  </BreadcrumbLink>
                </BreadcrumbItem>
                <BreadcrumbSeparator className="text-[#5c6b89] [&>svg]:stroke-[1.25]" />
                {typeCrumb ? (
                  <>
                    <BreadcrumbItem>
                      <BreadcrumbLink asChild className="text-[#5c6b89] hover:text-[#4a5768]">
                        <Link href="/boards">{surfboardsBrowseRootLabel}</Link>
                      </BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator className="text-[#5c6b89] [&>svg]:stroke-[1.25]" />
                    <BreadcrumbItem>
                      <BreadcrumbPage className="font-normal text-[#5c6b89]">{typeCrumb}</BreadcrumbPage>
                    </BreadcrumbItem>
                  </>
                ) : (
                  <BreadcrumbItem>
                    <BreadcrumbPage className="font-normal text-[#5c6b89]">
                      {surfboardsBrowseRootLabel}
                    </BreadcrumbPage>
                  </BreadcrumbItem>
                )}
              </BreadcrumbList>
            </Breadcrumb>
          </div>
          <div className="flex items-center justify-center gap-2">
            <h1 className="text-3xl font-bold text-center">{typeCrumb ?? surfboardsBrowseRootLabel}</h1>
            <BoardsBrowseAdminCurator isAdmin={isAdmin} />
          </div>
          <p className="text-center text-muted-foreground mt-2 max-w-2xl mx-auto text-sm sm:text-base">
            {boardsBrowseHeroSubtext(searchParams.type)}
          </p>
        </div>
      </section>

      <section className="pt-2 pb-4 min-w-0">
        <div className="container mx-auto min-w-0">
          <BoardsBrowseClient counts={facetCounts}>
            <Suspense fallback={<ListingTileGridSkeleton count={10} ariaLabel="Loading surfboards" />}>
              <BoardListings searchParams={searchParams} />
            </Suspense>
          </BoardsBrowseClient>
        </div>
      </section>
    </main>
  )
}
