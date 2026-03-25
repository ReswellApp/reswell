import Link from "next/link"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCategory, capitalizeWords, getPublicSellerDisplayName } from "@/lib/listing-labels"
import { createClient } from "@/lib/supabase/server"
import { MessageListingButton } from "@/components/message-listing-button"
import { FavoriteButtonCardOverlay } from "@/components/favorite-button-card-overlay"
import { VerifiedBadge } from "@/components/verified-badge"

export interface UsedGearSearchParams {
  category?: string
  condition?: string
  sort?: string
  q?: string
  page?: string
  minPrice?: string
  maxPrice?: string
  brand?: string
  size?: string
  color?: string
  /** surfpack | bag — Surfpacks & Bags page */
  pack?: string
  /** day | travel — Board bags page */
  boardBag?: string
  /** shirt | boardshorts | bikini | jacket | changing_towel | towel — Apparel & Lifestyle page */
  apparel?: string
  /** 2/2, 3/2, … — Wetsuits page */
  thickness?: string
  /** hooded | chestzip | backzip — Wetsuits page */
  zipType?: string
  /** feet as 5–12 — Leashes page */
  leashLength?: string
  /** e.g. 6mm — Leashes page */
  leashThickness?: string
  /** vintage_surfboards | vintage_apparel | … — Vintage category page */
  collectibleType?: string
  /** 70s | 80s | 90s | 2000s — Vintage category page */
  collectibleEra?: string
  /** mint | good | restored | display_only — Vintage category page */
  collectibleCondition?: string
}

export async function UsedGearListings({
  searchParams,
  basePath = "/used",
  fixedCategorySlug,
  clearFiltersHref,
  gearFilters = false,
  applyPackKindFilter = false,
  applyBoardBagKindFilter = false,
  applyApparelKindFilter = false,
  applyWetsuitFilters = false,
  applyLeashFilters = false,
  applyCollectibleFilters = false,
}: {
  searchParams: UsedGearSearchParams
  basePath?: string
  fixedCategorySlug?: string
  clearFiltersHref?: string
  gearFilters?: boolean
  applyPackKindFilter?: boolean
  applyBoardBagKindFilter?: boolean
  applyApparelKindFilter?: boolean
  applyWetsuitFilters?: boolean
  applyLeashFilters?: boolean
  applyCollectibleFilters?: boolean
}) {
  const supabase = await createClient()

  const category = fixedCategorySlug ?? searchParams.category ?? "all"
  const condition = searchParams.condition || "all"
  const sort = searchParams.sort || "newest"
  const query = searchParams.q || ""
  const minPrice = searchParams.minPrice ? Number(searchParams.minPrice) : undefined
  const maxPrice = searchParams.maxPrice ? Number(searchParams.maxPrice) : undefined
  const brand = searchParams.brand?.trim()
  const size = searchParams.size?.trim()
  const color = searchParams.color?.trim()
  const pack = searchParams.pack?.trim()
  const boardBag = searchParams.boardBag?.trim()
  const apparel = searchParams.apparel?.trim()
  const thickness = searchParams.thickness?.trim()
  const zipType = searchParams.zipType?.trim()
  const leashLength = searchParams.leashLength?.trim()
  const leashThickness = searchParams.leashThickness?.trim()
  const collectibleType = searchParams.collectibleType?.trim()
  const collectibleEra = searchParams.collectibleEra?.trim()
  const collectibleCondition = searchParams.collectibleCondition?.trim()
  const page = parseInt(searchParams.page || "1")
  const limit = 12
  const offset = (page - 1) * limit

  let dbQuery = supabase
    .from("listings")
    .select(
      `
      *,
      listing_images (url, is_primary),
      profiles (display_name, avatar_url, sales_count, shop_verified),
      categories (name, slug)
    `,
      { count: "exact" },
    )
    .eq("status", "active")
    .eq("section", "used")

  if (category !== "all") {
    const { data: catRow } = await supabase
      .from("categories")
      .select("id")
      .eq("slug", category)
      .eq("section", "used")
      .single()
    if (catRow?.id) {
      dbQuery = dbQuery.eq("category_id", catRow.id)
    } else {
      dbQuery = dbQuery.eq("category_id", "00000000-0000-0000-0000-000000000000")
    }
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

  if (gearFilters && brand && brand !== "all") {
    dbQuery = dbQuery.eq("brand", brand)
  }
  if (gearFilters && size && size !== "all") {
    dbQuery = dbQuery.eq("gear_size", size)
  }
  if (gearFilters && color && color !== "all") {
    dbQuery = dbQuery.eq("gear_color", color)
  }

  if (applyPackKindFilter && pack && pack !== "all") {
    dbQuery = dbQuery.eq("pack_kind", pack)
  }

  if (applyBoardBagKindFilter && boardBag && boardBag !== "all") {
    dbQuery = dbQuery.eq("board_bag_kind", boardBag)
  }

  if (applyApparelKindFilter && apparel && apparel !== "all") {
    dbQuery = dbQuery.eq("apparel_kind", apparel)
  }
  if (applyApparelKindFilter && size && size !== "all") {
    dbQuery = dbQuery.eq("gear_size", size)
  }

  if (applyWetsuitFilters && size && size !== "all") {
    dbQuery = dbQuery.eq("wetsuit_size", size)
  }
  if (applyWetsuitFilters && thickness && thickness !== "all") {
    dbQuery = dbQuery.eq("wetsuit_thickness", thickness)
  }
  if (applyWetsuitFilters && zipType && zipType !== "all") {
    dbQuery = dbQuery.eq("wetsuit_zip_type", zipType)
  }

  if (applyLeashFilters && leashLength && leashLength !== "all") {
    dbQuery = dbQuery.eq("leash_length", leashLength)
  }
  if (applyLeashFilters && leashThickness && leashThickness !== "all") {
    dbQuery = dbQuery.eq("leash_thickness", leashThickness)
  }

  if (applyCollectibleFilters && collectibleType && collectibleType !== "all") {
    dbQuery = dbQuery.eq("collectible_type", collectibleType)
  }
  if (applyCollectibleFilters && collectibleEra && collectibleEra !== "all") {
    dbQuery = dbQuery.eq("collectible_era", collectibleEra)
  }
  if (applyCollectibleFilters && collectibleCondition && collectibleCondition !== "all") {
    dbQuery = dbQuery.eq("collectible_condition", collectibleCondition)
  }

  dbQuery = dbQuery.eq("shipping_available", true)

  if (query) {
    const escaped = query.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
    const pattern = `"%${escaped}%"`
    const { data: matchingCats } = await supabase
      .from("categories")
      .select("id")
      .eq("section", "used")
      .or(`name.ilike.${pattern},slug.ilike.${pattern}`)
    const categoryIds = (matchingCats ?? []).map((c) => c.id)
    const orParts = [`title.ilike.${pattern}`, `description.ilike.${pattern}`]
    if (categoryIds.length > 0) orParts.push(`category_id.in.(${categoryIds.join(",")})`)
    dbQuery = dbQuery.or(orParts.join(","))
  }

  const isDefaultSort = sort === "newest"

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

  const { data: rawListings, count } = await dbQuery.range(offset, offset + limit - 1)

  const listings =
    isDefaultSort && rawListings
      ? [...rawListings].sort((a, b) => {
          const salesA = a.profiles?.sales_count ?? 0
          const salesB = b.profiles?.sales_count ?? 0
          if (salesB !== salesA) return salesB - salesA
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        })
      : rawListings

  const totalPages = Math.ceil((count || 0) / limit)

  function pageUrl(pageNum: number) {
    const params = new URLSearchParams()
    if (searchParams.q) params.set("q", searchParams.q)
    if (!fixedCategorySlug && searchParams.category && searchParams.category !== "all") {
      params.set("category", searchParams.category)
    }
    if (searchParams.condition && searchParams.condition !== "all") params.set("condition", searchParams.condition)
    if (searchParams.minPrice) params.set("minPrice", searchParams.minPrice)
    if (searchParams.maxPrice) params.set("maxPrice", searchParams.maxPrice)
    if (gearFilters && searchParams.brand && searchParams.brand !== "all") params.set("brand", searchParams.brand)
    if (gearFilters && searchParams.size && searchParams.size !== "all") params.set("size", searchParams.size)
    if (gearFilters && searchParams.color && searchParams.color !== "all") params.set("color", searchParams.color)
    if (applyPackKindFilter && searchParams.pack && searchParams.pack !== "all") params.set("pack", searchParams.pack)
    if (applyBoardBagKindFilter && searchParams.boardBag && searchParams.boardBag !== "all") {
      params.set("boardBag", searchParams.boardBag)
    }
    if (applyApparelKindFilter && searchParams.apparel && searchParams.apparel !== "all") {
      params.set("apparel", searchParams.apparel)
    }
    if (applyApparelKindFilter && searchParams.size && searchParams.size !== "all") {
      params.set("size", searchParams.size)
    }
    if (applyWetsuitFilters && searchParams.size && searchParams.size !== "all") {
      params.set("size", searchParams.size)
    }
    if (applyWetsuitFilters && searchParams.thickness && searchParams.thickness !== "all") {
      params.set("thickness", searchParams.thickness)
    }
    if (applyWetsuitFilters && searchParams.zipType && searchParams.zipType !== "all") {
      params.set("zipType", searchParams.zipType)
    }
    if (applyLeashFilters && searchParams.leashLength && searchParams.leashLength !== "all") {
      params.set("leashLength", searchParams.leashLength)
    }
    if (applyLeashFilters && searchParams.leashThickness && searchParams.leashThickness !== "all") {
      params.set("leashThickness", searchParams.leashThickness)
    }
    if (applyCollectibleFilters && searchParams.collectibleType && searchParams.collectibleType !== "all") {
      params.set("collectibleType", searchParams.collectibleType)
    }
    if (applyCollectibleFilters && searchParams.collectibleEra && searchParams.collectibleEra !== "all") {
      params.set("collectibleEra", searchParams.collectibleEra)
    }
    if (applyCollectibleFilters && searchParams.collectibleCondition && searchParams.collectibleCondition !== "all") {
      params.set("collectibleCondition", searchParams.collectibleCondition)
    }
    if (searchParams.sort && searchParams.sort !== "newest") params.set("sort", searchParams.sort)
    params.set("page", String(pageNum))
    const qs = params.toString()
    return qs ? `${basePath}?${qs}` : basePath
  }

  const clearHref = clearFiltersHref ?? basePath

  if (!listings || listings.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">No listings found matching your criteria.</p>
        <Button variant="outline" className="mt-4 bg-transparent" asChild>
          <Link href={clearHref}>Clear Filters</Link>
        </Button>
      </div>
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()
  let favoritedIds: string[] = []
  if (user && listings.length > 0) {
    const { data: favs } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .in(
        "listing_id",
        listings.map((l) => l.id),
      )
    favoritedIds = (favs ?? []).map((f) => f.listing_id)
  }

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {listings.map((listing) => {
          const primaryImage =
            listing.listing_images?.find((img: { is_primary: boolean }) => img.is_primary) ||
            listing.listing_images?.[0]
          return (
            <Card key={listing.id} className="group overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col">
              <Link href={`/used/${listing.slug || listing.id}`} className="flex-1 flex flex-col">
                <div className="aspect-[4/5] relative bg-muted overflow-hidden">
                  {primaryImage?.url ? (
                    <Image
                      src={primaryImage.url || "/placeholder.svg"}
                      alt={capitalizeWords(listing.title)}
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
                    listingId={listing.id}
                    initialFavorited={favoritedIds.includes(listing.id)}
                    isLoggedIn={!!user}
                  />
                </div>
                <CardContent className="p-4">
                  <h3 className="font-medium line-clamp-2">{capitalizeWords(listing.title)}</h3>
                  <p className="text-xl font-bold text-black dark:text-white mt-2">${listing.price.toFixed(2)}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-sm text-muted-foreground flex items-center gap-1">
                      {getPublicSellerDisplayName(listing.profiles)}
                      {listing.profiles?.shop_verified && <VerifiedBadge size="sm" />}
                    </p>
                    {listing.categories?.name && (
                      <Badge variant="outline" className="text-xs">
                        {formatCategory(listing.categories.name)}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Link>
              <div className="px-4 pb-4 pt-0">
                <MessageListingButton
                  listingId={listing.id}
                  sellerId={listing.user_id}
                  redirectPath={`/used/${listing.slug || listing.id}`}
                />
              </div>
            </Card>
          )
        })}
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
