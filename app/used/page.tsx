import { Suspense } from "react"
import Link from "next/link"
import Image from "next/image"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/server"
import { Search, SlidersHorizontal } from "lucide-react"

const categories = [
  { value: "all", label: "All Categories" },
  { value: "surfboards", label: "Surfboards" },
  { value: "wetsuits", label: "Wetsuits" },
  { value: "fins", label: "Fins" },
  { value: "leashes", label: "Leashes" },
  { value: "traction-pads", label: "Traction Pads" },
  { value: "board-bags", label: "Board Bags" },
  { value: "accessories", label: "Other Accessories" },
]

const conditions = [
  { value: "all", label: "Any Condition" },
  { value: "new", label: "New" },
  { value: "like-new", label: "Like New" },
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
]

const sortOptions = [
  { value: "newest", label: "Newest First" },
  { value: "price-low", label: "Price: Low to High" },
  { value: "price-high", label: "Price: High to Low" },
]

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
    dbQuery = dbQuery.eq("categories.slug", category)
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
                    {listing.condition}
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
                        {listing.categories.name}
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
              <Link
                href={{
                  pathname: "/used",
                  query: { ...searchParams, page: page - 1 },
                }}
              >
                Previous
              </Link>
            </Button>
          )}
          <span className="flex items-center px-4 text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </span>
          {page < totalPages && (
            <Button variant="outline" asChild>
              <Link
                href={{
                  pathname: "/used",
                  query: { ...searchParams, page: page + 1 },
                }}
              >
                Next
              </Link>
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
            <form className="flex flex-wrap gap-4 items-center">
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  name="q"
                  placeholder="Search listings..."
                  defaultValue={searchParams.q}
                  className="pl-10"
                />
              </div>
              
              <Select name="category" defaultValue={searchParams.category || "all"}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="Category" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((cat) => (
                    <SelectItem key={cat.value} value={cat.value}>
                      {cat.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select name="condition" defaultValue={searchParams.condition || "all"}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Condition" />
                </SelectTrigger>
                <SelectContent>
                  {conditions.map((cond) => (
                    <SelectItem key={cond.value} value={cond.value}>
                      {cond.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select name="sort" defaultValue={searchParams.sort || "newest"}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  {sortOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button type="submit">
                <SlidersHorizontal className="h-4 w-4 mr-2" />
                Apply
              </Button>
            </form>
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
