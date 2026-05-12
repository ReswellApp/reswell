import { Suspense } from "react"
import Link from "next/link"
import { redirect } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { applyListingsLocationTextFilter } from "@/lib/listing-location-or-filter"
import { Users } from "lucide-react"
import { HomePeerListingScrollTile } from "@/components/features/home/home-peer-listing-scroll-tile"
import type { ListingImageForCard } from "@/lib/listing-image-display"
import {
  boardTypeForDbFromBrowseParam,
  boardsBrowseBoardTypeLabel,
  boardsBrowseHeroSubtext,
  BOARDS_BROWSE_DEFAULT_SORT,
  type BoardsBrowseSearchParams,
} from "@/lib/marketplace-slug-metadata"
import { forwardGeocodePlaceForServer } from "@/lib/maps/forward-geocode-server"
import { surfboardsBrowseRootLabel } from "@/lib/site-category-directory"
import type { PostgrestClientOptions, PostgrestFilterBuilder } from "@supabase/postgrest-js"

/**
 * Explicit chain type so `async function` return is not inferred as `PostgrestSingleResponse`
 * (PostgREST builders are `PromiseLike` their own HTTP result).
 */
type SurfboardBrowseListingsQuery = PostgrestFilterBuilder<
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

type BoardBrowseListingRow = {
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
}

function haversineMi(
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

const SURFBOARD_BROWSE_LISTING_SELECT = `
  *,
  listing_images (url, thumbnail_url, is_primary),
  categories (name),
  profiles!listings_user_id_fkey (display_name, avatar_url, location, shop_verified)
`

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>

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
async function buildSurfboardBrowseBaseQuery(
  supabase: SupabaseServerClient,
  params: {
    boardType: string
    condition: string
    query: string
    minPrice?: number
    maxPrice?: number
    geoBbox?: { lat: number; lng: number; radiusMiles: number }
    /**
     * Apply pagination before the keyword `.or()` so `.range()` is always on a full
     * PostgrestFilterBuilder (some chains lose `.range` / URL access after `.or()`).
     */
    rangeBeforeKeywordOr?: { from: number; to: number }
    /**
     * Paginated /boards SQL path (non–in-memory geo). Applied after sort orders, before
     * location text and keyword `.or()` — same rationale as `rangeBeforeKeywordOr`.
     */
    pagedRange?: { from: number; to: number }
    /**
     * Geo / nearest paths later call `.range()`; keyword search uses `.or()`. On some
     * Supabase+PostgREST chains, `.order()` after `.or()` is missing — set this to apply
     * `created_at` desc before the keyword `.or()` so the builder stays consistent.
     */
    prependCreatedAtOrder?: boolean
    /**
     * Sort for the paginated SQL path only (omitted for in-memory geo / nearest browsing).
     * Applied before location text filters and keyword `.or()` so `.order()` is never
     * chained after an `.or()`.
     */
    pagedSort?: string
    /**
     * City/state text narrow; must run after `.order()` and before keyword `.or()` so the
     * client chain does not lose `.order` / `.range` after `.or()`.
     */
    locationTextFilter?: string
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
    const s = params.pagedSort
    if (s === "price-low") {
      dbQuery = dbQuery.order("price", { ascending: true })
    } else if (s === "price-high") {
      dbQuery = dbQuery.order("price", { ascending: false, nullsFirst: false })
    } else if (s === "newest") {
      dbQuery = dbQuery.order("created_at", { ascending: false })
    } else {
      dbQuery = dbQuery
        .order("price", { ascending: false, nullsFirst: false })
        .order("created_at", { ascending: false })
    }
  }

  if (params.pagedRange) {
    dbQuery = dbQuery.range(params.pagedRange.from, params.pagedRange.to)
  }

  const loc = params.locationTextFilter?.trim()
  if (loc) {
    dbQuery = applyListingsLocationTextFilter(dbQuery, loc)
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

const LOCATION_FALLBACK_RADIUS_MI = 100
const LOCATION_FALLBACK_WIDE_RADIUS_MI = 2200

/**
 * Geodistance search: no city/state text filter — uses listing lat/lng only.
 * Results sorted nearest-first; capped at `radiusCapMi` miles from anchor.
 */
async function fetchNearestSurfboardsWithinRadius(params: {
  supabase: SupabaseServerClient
  anchorLat: number
  anchorLng: number
  radiusCapMi: number
  boardType: string
  condition: string
  query: string
  minPrice?: number
  maxPrice?: number
  offset: number
  limit: number
  maxFetch: number
}) {
  let dbQuery = (await buildSurfboardBrowseBaseQuery(params.supabase, {
    boardType: params.boardType,
    condition: params.condition,
    query: params.query,
    minPrice: params.minPrice,
    maxPrice: params.maxPrice,
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

async function BoardListings({ searchParams }: { searchParams: BoardsBrowseSearchParams }) {
  const supabase = await createClient()

  const boardType = searchParams.type || "all"
  const condition = searchParams.condition || "all"
  const sort = searchParams.sort || BOARDS_BROWSE_DEFAULT_SORT
  const query = searchParams.q || ""
  const location = searchParams.location || ""
  const minPrice = searchParams.minPrice ? Number(searchParams.minPrice) : undefined
  const maxPrice = searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined
  const radiusMi = searchParams.radius ? Number(searchParams.radius) : undefined
  const lat = searchParams.lat ? Number(searchParams.lat) : undefined
  const lng = searchParams.lng ? Number(searchParams.lng) : undefined
  const page = parseInt(searchParams.page || "1")
  const limit = 30
  const offset = (page - 1) * limit
  const geoBrowseMaxRows = 500

  const hasLatLng = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)
  const hasRadius = radiusMi != null && !Number.isNaN(radiusMi) && radiusMi > 0
  const filterByRadius = hasLatLng && hasRadius
  const isNearestSort = sort === "nearest" && hasLatLng

  const useGeocodedAnchor = hasLatLng && (filterByRadius || isNearestSort)

  let listingsChain = (await buildSurfboardBrowseBaseQuery(supabase, {
    boardType,
    condition,
    query,
    minPrice,
    maxPrice,
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
  let boards: Awaited<ReturnType<ReturnType<typeof supabase.from>["select"]>>["data"]
  let totalPages: number

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
      withDistance.sort((a, b) => a._distance - b._distance)
    } else {
      withDistance.sort((a: GeoListingRow, b: GeoListingRow) => {
        const pa = Number(a.price ?? 0)
        const pb = Number(b.price ?? 0)
        const ta = new Date(a.created_at ?? 0).getTime()
        const tb = new Date(b.created_at ?? 0).getTime()
        if (sort === "price-low") return pa - pb
        if (sort === "price-high") return pb - pa
        if (sort === "newest") return tb - ta
        const priceDiff = pb - pa
        if (priceDiff !== 0) return priceDiff
        return tb - ta
      })
    }
    totalPages = Math.ceil(withDistance.length / limit)
    boards = withDistance.slice(offset, offset + limit)
  } else {
    const { data: rawBoards, count } = await listingsChain

    boards = rawBoards

    totalPages = Math.ceil((count || 0) / limit)
  }

  let locationFallbackNotice: string | null = null

  if (!boards || boards.length === 0) {
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
          minPrice,
          maxPrice,
          offset,
          limit,
          maxFetch: radiusCapMi >= LOCATION_FALLBACK_WIDE_RADIUS_MI ? 4000 : 2500,
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
    if (searchParams.location) params.set("location", searchParams.location)
    if (searchParams.type && searchParams.type !== "all") params.set("type", searchParams.type)
    if (searchParams.condition && searchParams.condition !== "all")
      params.set("condition", searchParams.condition)
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
          <h1 className="text-3xl font-bold text-center">{typeCrumb ?? surfboardsBrowseRootLabel}</h1>
          <p className="text-center text-muted-foreground mt-2 max-w-2xl mx-auto text-sm sm:text-base">
            {boardsBrowseHeroSubtext(searchParams.type)}
          </p>
        </div>
      </section>

      <section className="pt-2 pb-4 min-w-0">
        <div className="container mx-auto min-w-0">
          <BoardsBrowseClient
            initialQ={searchParams.q ?? ""}
            initialLocation={searchParams.location ?? ""}
            initialRadius={searchParams.radius ?? ""}
            initialType={searchParams.type ?? "all"}
            initialCondition={searchParams.condition ?? "all"}
            initialSort={searchParams.sort ?? BOARDS_BROWSE_DEFAULT_SORT}
          >
            <Suspense
              fallback={
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <Card key={i} className="overflow-hidden">
                      <div className="aspect-[3/4] w-full skeleton" />
                      <CardContent className="p-3 space-y-2">
                        <div className="h-3.5 skeleton" style={{ width: `${60 + (i % 3) * 15}%` }} />
                        <div className="h-3 skeleton" style={{ width: `${40 + (i % 4) * 10}%` }} />
                        <div className="h-5 w-16 skeleton" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              }
            >
              <BoardListings searchParams={searchParams} />
            </Suspense>
          </BoardsBrowseClient>
        </div>
      </section>
    </main>
  )
}
