import { Suspense } from "react"
import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { capitalizeWords } from "@/lib/listing-labels"
import { createClient } from "@/lib/supabase/server"
import { BoardsListingsFilters } from "@/components/boards-listings-filters"
import { applyListingsLocationTextFilter } from "@/lib/listing-location-or-filter"
import { MapPin, Users } from "lucide-react"
import { MessageListingButton } from "@/components/message-listing-button"
import { FavoriteButtonCardOverlay } from "@/components/favorite-button-card-overlay"

function haversineMi(
  lat1: number,
  lon1: number,
  lat2: number | null | undefined,
  lon2: number | null | undefined
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

interface SearchParams {
  type?: string
  condition?: string
  sort?: string
  q?: string
  location?: string
  page?: string
  brand?: string
  minPrice?: string
  maxPrice?: string
  radius?: string
  lat?: string
  lng?: string
}

async function BoardListings({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient()
  
  const boardType = searchParams.type || "all"
  const condition = searchParams.condition || "all"
  const sort = searchParams.sort || "newest"
  const query = searchParams.q || ""
  const location = searchParams.location || ""
  const minPrice = searchParams.minPrice ? Number(searchParams.minPrice) : undefined
  const maxPrice = searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined
  const radiusMi = searchParams.radius ? Number(searchParams.radius) : undefined
  const lat = searchParams.lat ? Number(searchParams.lat) : undefined
  const lng = searchParams.lng ? Number(searchParams.lng) : undefined
  const page = parseInt(searchParams.page || "1")
  const limit = 12
  const offset = (page - 1) * limit

  let dbQuery = supabase
    .from("listings")
    .select(`
      *,
      listing_images (url, is_primary),
      profiles (display_name, avatar_url, location, sales_count, shop_verified)
    `, { count: "exact" })
    .eq("status", "active")
    .eq("section", "surfboards")

  if (boardType !== "all") {
    dbQuery = dbQuery.eq("board_type", boardType)
  }

  if (condition !== "all") {
    dbQuery = dbQuery.eq("condition", condition)
  }

  if (minPrice != null && !Number.isNaN(minPrice) && minPrice >= 0) {
    dbQuery = dbQuery.gte("price", minPrice)
  }
  if (maxPrice != null && !Number.isNaN(maxPrice) && maxPrice >= 0) {
    dbQuery = dbQuery.lte("price", maxPrice)
  }

  if (query) {
    const escaped = query.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
    const pattern = `"%${escaped}%"`
    const { data: matchingCats } = await supabase
      .from("categories")
      .select("id")
      .eq("section", "surfboards")
      .or(`name.ilike.${pattern},slug.ilike.${pattern}`)
    const categoryIds = (matchingCats ?? []).map((c) => c.id)
    const orParts = [`title.ilike.${pattern}`, `description.ilike.${pattern}`]
    if (categoryIds.length > 0) orParts.push(`category_id.in.(${categoryIds.join(",")})`)
    dbQuery = dbQuery.or(orParts.join(","))
  }

  if (location) {
    dbQuery = applyListingsLocationTextFilter(dbQuery, location)
  }

  const hasLatLng = lat != null && lng != null && !Number.isNaN(lat) && !Number.isNaN(lng)
  const hasRadius = radiusMi != null && !Number.isNaN(radiusMi) && radiusMi > 0
  const filterByRadius = hasLatLng && hasRadius
  const isNearestSort = sort === "nearest" && hasLatLng

  let boards: Awaited<ReturnType<ReturnType<typeof supabase.from>["select"]>>["data"]
  let totalPages: number

  if (filterByRadius || isNearestSort) {
    dbQuery = dbQuery.order("created_at", { ascending: false })
    const maxFetch = 500
    const { data: rawBoards } = await dbQuery.range(0, maxFetch - 1)
    let withDistance = (rawBoards || []).map((b) => ({
      ...b,
      _distance: haversineMi(lat!, lng!, b.latitude, b.longitude),
    }))
    if (filterByRadius) {
      withDistance = withDistance.filter((b) => b._distance <= radiusMi!)
    }
    if (isNearestSort) {
      withDistance.sort((a, b) => a._distance - b._distance)
    } else {
      withDistance.sort((a, b) => {
        if (sort === "price-low") return (a.price ?? 0) - (b.price ?? 0)
        if (sort === "price-high") return (b.price ?? 0) - (a.price ?? 0)
        const salesA = a.profiles?.sales_count ?? 0
        const salesB = b.profiles?.sales_count ?? 0
        if (salesB !== salesA) return salesB - salesA
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    }
    totalPages = Math.ceil(withDistance.length / limit)
    boards = withDistance.slice(offset, offset + limit)
  } else {
    switch (sort) {
      case "price-low":
        dbQuery = dbQuery.order("price", { ascending: true })
        break
      case "price-high":
        dbQuery = dbQuery.order("price", { ascending: false })
        break
      default:
        dbQuery = dbQuery.order("created_at", { ascending: false })
    }

    const { data: rawBoards, count } = await dbQuery.range(offset, offset + limit - 1)

    const isDefaultSort = sort === "newest"
    boards = isDefaultSort && rawBoards
      ? [...rawBoards].sort((a, b) => {
          const salesA = a.profiles?.sales_count ?? 0
          const salesB = b.profiles?.sales_count ?? 0
          if (salesB !== salesA) return salesB - salesA
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
      : rawBoards

    totalPages = Math.ceil((count || 0) / limit)
  }

  function pageUrl(pageNum: number) {
    const params = new URLSearchParams()
    if (searchParams.q) params.set("q", searchParams.q)
    if (searchParams.location) params.set("location", searchParams.location)
    if (searchParams.type && searchParams.type !== "all") params.set("type", searchParams.type)
    if (searchParams.condition && searchParams.condition !== "all") params.set("condition", searchParams.condition)
    if (searchParams.minPrice) params.set("minPrice", searchParams.minPrice)
    if (searchParams.maxPrice) params.set("maxPrice", searchParams.maxPrice)
    if (searchParams.radius) params.set("radius", searchParams.radius)
    if (searchParams.lat) params.set("lat", searchParams.lat)
    if (searchParams.lng) params.set("lng", searchParams.lng)
    if (searchParams.sort && searchParams.sort !== "newest") params.set("sort", searchParams.sort)
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

  const { data: { user } } = await supabase.auth.getUser()
  let favoritedIds: string[] = []
  if (user && boards.length > 0) {
    const { data: favs } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .in("listing_id", boards.map((b) => b.id))
    favoritedIds = (favs ?? []).map((f) => f.listing_id)
  }

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {boards.map((board) => {
          const primaryImage = board.listing_images?.find((img: { is_primary: boolean }) => img.is_primary) || board.listing_images?.[0]
          return (
            <Card key={board.id} className="group overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col">
              <Link href={`/boards/${board.slug || board.id}`} className="flex-1 flex flex-col">
                <div className="aspect-[4/5] relative bg-muted overflow-hidden">
                  {primaryImage?.url ? (
                    <Image
                      src={primaryImage.url || "/placeholder.svg"}
                      alt={capitalizeWords(board.title)}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                      style={{ objectFit: "cover" }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                      No Image
                    </div>
                  )}
                  <FavoriteButtonCardOverlay
                    listingId={board.id}
                    initialFavorited={favoritedIds.includes(board.id)}
                    isLoggedIn={!!user}
                  />
                </div>
                <CardContent className="p-4">
                  <h3 className="font-medium line-clamp-2">{capitalizeWords(board.title)}</h3>
                  {board.board_length && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {board.board_length}
                    </p>
                  )}
                  <p className="text-xl font-bold text-black dark:text-white mt-2">
                    ${board.price.toFixed(2)}
                  </p>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                    <MapPin className="h-3 w-3" />
                    {board.city && board.state
                      ? `${board.city}, ${board.state}`
                      : board.profiles?.location || "Location not set"}
                  </div>
                </CardContent>
              </Link>
              <div className="px-4 pb-4 pt-0">
                <MessageListingButton
                  listingId={board.id}
                  sellerId={board.user_id}
                  redirectPath={`/boards/${board.slug || board.id}`}
                />
              </div>
            </Card>
          )
        })}
      </div>

      {/* Pagination */}
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

export default async function BoardsPage(props: {
  searchParams: Promise<SearchParams>
}) {
  const searchParams = await props.searchParams
  
  return (
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-offwhite py-12">
          <div className="container mx-auto">
            <h1 className="text-3xl font-bold text-center">Surfboards</h1>
            <p className="text-center text-muted-foreground mt-2">
              Find local boards for pickup from sellers in your area
            </p>
          </div>
        </section>

        <section className="py-4 min-w-0">
          <div className="container mx-auto min-w-0">
            <div className="border-b py-4 mb-6 min-w-0 overflow-x-auto">
              <div className="min-w-0">
                <BoardsListingsFilters
                  initialQ={searchParams.q ?? ""}
                  initialLocation={searchParams.location ?? ""}
                  initialType={searchParams.type ?? "all"}
                  initialCondition={searchParams.condition ?? "all"}
                  initialMinPrice={searchParams.minPrice ?? ""}
                  initialMaxPrice={searchParams.maxPrice ?? ""}
                  initialRadius={searchParams.radius ?? ""}
                  initialSort={searchParams.sort ?? "newest"}
                />
              </div>
            </div>

            <Suspense
              fallback={
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Card key={i} className="overflow-hidden">
                      <div className="aspect-[4/5] bg-muted animate-pulse" />
                      <CardContent className="p-4 space-y-2">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                        <div className="h-6 w-20 bg-muted rounded animate-pulse" />
                        <div className="h-4 w-32 bg-muted rounded animate-pulse" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              }
            >
              <BoardListings searchParams={searchParams} />
            </Suspense>
          </div>
        </section>
      </main>
  )
}
