import { Suspense } from "react"
import Link from "next/link"
import Image from "next/image"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCondition, formatCategory } from "@/lib/listing-labels"
import { createClient } from "@/lib/supabase/server"
import { UsedListingsFilters } from "@/components/used-listings-filters"

interface SearchParams {
  category?: string
  condition?: string
  sort?: string
  q?: string
  page?: string
}

async function UsedListings({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient()
  
  const category = searchParams.category || "all"
  const condition = searchParams.condition || "all"
  const sort = searchParams.sort || "newest"
  const query = searchParams.q || ""
  const page = parseInt(searchParams.page || "1")
  const limit = 12
  const offset = (page - 1) * limit

  let dbQuery = supabase
    .from("listings")
    .select(`
      *,
      listing_images (url, is_primary),
      profiles (display_name, avatar_url, sales_count),
      categories (name, slug)
    `, { count: "exact" })
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

  if (query) {
    dbQuery = dbQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`)
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

  // When using default sort (no filters chosen), prioritize listings from
  // sellers with the most sales as a reward for being a good seller
  const listings = isDefaultSort && rawListings
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
    if (searchParams.category && searchParams.category !== "all") params.set("category", searchParams.category)
    if (searchParams.condition && searchParams.condition !== "all") params.set("condition", searchParams.condition)
    if (searchParams.sort && searchParams.sort !== "newest") params.set("sort", searchParams.sort)
    params.set("page", String(pageNum))
    return `/used?${params.toString()}`
  }

  if (!listings || listings.length === 0) {
    return (
      <div className="text-center py-16">
        <p className="text-muted-foreground">No listings found matching your criteria.</p>
        <Button variant="outline" className="mt-4 bg-transparent" asChild>
          <Link href="/used">Clear Filters</Link>
        </Button>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {listings.map((listing) => {
          const primaryImage = listing.listing_images?.find((img: { is_primary: boolean }) => img.is_primary) || listing.listing_images?.[0]
          return (
            <Link key={listing.id} href={`/used/${listing.id}`}>
              <Card className="group overflow-hidden hover:shadow-lg transition-shadow h-full">
                <div className="aspect-square relative bg-muted">
                  {primaryImage?.url ? (
                    <Image
                      src={primaryImage.url || "/placeholder.svg"}
                      alt={listing.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                      No Image
                    </div>
                  )}
                  <Badge className="absolute top-2 left-2" variant="secondary">
                    {formatCondition(listing.condition)}
                  </Badge>
                  {listing.allows_shipping && (
                    <Badge className="absolute top-2 right-2 bg-primary text-primary-foreground">
                      Ships
                    </Badge>
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-medium line-clamp-2">{listing.title}</h3>
                  <p className="text-xl font-bold text-primary mt-2">
                    ${listing.price.toFixed(2)}
                  </p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-sm text-muted-foreground">
                      {listing.profiles?.display_name || "Anonymous"}
                    </p>
                    {listing.categories?.name && (
                      <Badge variant="outline" className="text-xs">
                        {formatCategory(listing.categories.name)}
                      </Badge>
                    )}
                  </div>
                </CardContent>
              </Card>
            </Link>
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

export default async function UsedGearPage(props: {
  searchParams: Promise<SearchParams>
}) {
  const searchParams = await props.searchParams
  const supabase = await createClient()
  const { data: usedCategories } = await supabase
    .from("categories")
    .select("id, name, slug")
    .eq("section", "used")
    .order("name")

  // Exclude Hardware & Accessories and Travel & Storage from used section
  const excludedSlugs = ["hardware-accessories", "travel-storage"]
  const filtered = usedCategories?.filter((c) => !excludedSlugs.includes(c.slug)) ?? []
  const slugsAtBottom = ["apparel-lifestyle", "collectibles-vintage"]
  const sorted = filtered.slice().sort((a, b) => {
    const aAtBottom = slugsAtBottom.indexOf(a.slug)
    const bAtBottom = slugsAtBottom.indexOf(b.slug)
    if (aAtBottom === -1 && bAtBottom === -1) return 0
    if (aAtBottom === -1) return -1
    if (bAtBottom === -1) return 1
    return aAtBottom - bAtBottom
  })

  const categoryOptions = [
    { value: "all", label: "All Categories" },
    ...sorted.map((c) => ({ value: c.slug, label: c.name })),
  ]

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-b from-primary/5 to-background py-12">
          <div className="container mx-auto px-4">
            <h1 className="text-3xl font-bold text-center">Used Surf Gear</h1>
            <p className="text-center text-muted-foreground mt-2">
              Find great deals on pre-loved surf accessories
            </p>
          </div>
        </section>

        {/* Filters */}
        <section className="border-b py-4 sticky top-16 bg-background z-40">
          <div className="container mx-auto px-4">
            <UsedListingsFilters
              categoryOptions={categoryOptions}
              initialQ={searchParams.q ?? ""}
              initialCategory={searchParams.category ?? "all"}
              initialCondition={searchParams.condition ?? "all"}
              initialSort={searchParams.sort ?? "newest"}
            />
          </div>
        </section>

        {/* Listings */}
        <section className="py-8">
          <div className="container mx-auto px-4">
            <Suspense
              fallback={
                <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {Array.from({ length: 8 }).map((_, i) => (
                    <Card key={i} className="overflow-hidden">
                      <div className="aspect-square bg-muted animate-pulse" />
                      <CardContent className="p-4 space-y-2">
                        <div className="h-4 bg-muted rounded animate-pulse" />
                        <div className="h-6 w-20 bg-muted rounded animate-pulse" />
                      </CardContent>
                    </Card>
                  ))}
                </div>
              }
            >
              <UsedListings searchParams={searchParams} />
            </Suspense>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
