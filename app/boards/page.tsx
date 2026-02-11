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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createClient } from "@/lib/supabase/server"
import { Search, MapPin, SlidersHorizontal, Users, Store } from "lucide-react"
import { ShopifyBoardsGrid } from "@/components/shopify-boards"

const boardTypes = [
  { value: "all", label: "All Board Types" },
  { value: "shortboard", label: "Shortboard" },
  { value: "longboard", label: "Longboard" },
  { value: "funboard", label: "Funboard / Mid-length" },
  { value: "fish", label: "Fish" },
  { value: "gun", label: "Gun" },
  { value: "foamie", label: "Foam / Soft Top" },
  { value: "other", label: "Other" },
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
  { value: "nearest", label: "Nearest First" },
]

interface SearchParams {
  type?: string
  condition?: string
  sort?: string
  q?: string
  location?: string
  page?: string
}

async function BoardListings({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient()
  
  const boardType = searchParams.type || "all"
  const condition = searchParams.condition || "all"
  const sort = searchParams.sort || "newest"
  const query = searchParams.q || ""
  const location = searchParams.location || ""
  const page = parseInt(searchParams.page || "1")
  const limit = 12
  const offset = (page - 1) * limit

  let dbQuery = supabase
    .from("listings")
    .select(`
      *,
      listing_images (url, is_primary),
      profiles (display_name, avatar_url, location, sales_count)
    `, { count: "exact" })
    .eq("status", "active")
    .eq("section", "board")

  if (boardType !== "all") {
    dbQuery = dbQuery.eq("board_type", boardType)
  }

  if (condition !== "all") {
    dbQuery = dbQuery.eq("condition", condition)
  }

  if (query) {
    dbQuery = dbQuery.or(`title.ilike.%${query}%,description.ilike.%${query}%`)
  }

  if (location) {
    dbQuery = dbQuery.ilike("profiles.location", `%${location}%`)
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

  const { data: rawBoards, count } = await dbQuery.range(offset, offset + limit - 1)

  // When using default sort, prioritize listings from sellers with the most sales
  const boards = isDefaultSort && rawBoards
    ? [...rawBoards].sort((a, b) => {
        const salesA = a.profiles?.sales_count ?? 0
        const salesB = b.profiles?.sales_count ?? 0
        if (salesB !== salesA) return salesB - salesA
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      })
    : rawBoards

  const totalPages = Math.ceil((count || 0) / limit)

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

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {boards.map((board) => {
          const primaryImage = board.listing_images?.find((img: { is_primary: boolean }) => img.is_primary) || board.listing_images?.[0]
          return (
            <Link key={board.id} href={`/boards/${board.id}`}>
              <Card className="group overflow-hidden hover:shadow-lg transition-shadow h-full">
                <div className="aspect-[4/5] relative bg-muted">
                  {primaryImage?.url ? (
                    <Image
                      src={primaryImage.url || "/placeholder.svg"}
                      alt={board.title}
                      fill
                      className="object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                      No Image
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    <Badge variant="secondary">{board.condition}</Badge>
                    {board.board_type && (
                      <Badge variant="outline" className="bg-background/80 capitalize">
                        {board.board_type}
                      </Badge>
                    )}
                  </div>
                  <Badge className="absolute bottom-2 right-2 bg-background/80 text-foreground">
                    <MapPin className="h-3 w-3 mr-1" />
                    In-Person Only
                  </Badge>
                </div>
                <CardContent className="p-4">
                  <h3 className="font-medium line-clamp-2">{board.title}</h3>
                  {board.board_length && (
                    <p className="text-sm text-muted-foreground mt-1">
                      {board.board_length}
                    </p>
                  )}
                  <p className="text-xl font-bold text-primary mt-2">
                    ${board.price.toFixed(2)}
                  </p>
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                    <MapPin className="h-3 w-3" />
                    {board.city && board.state
                      ? `${board.city}, ${board.state}`
                      : board.profiles?.location || "Location not set"}
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
                  pathname: "/boards",
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
                  pathname: "/boards",
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

export default async function BoardsPage(props: {
  searchParams: Promise<SearchParams>
}) {
  const searchParams = await props.searchParams
  
  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1">
        {/* Hero */}
        <section className="bg-gradient-to-b from-secondary/50 to-background py-12">
          <div className="container mx-auto px-4">
            <h1 className="text-3xl font-bold text-center">Surfboards</h1>
            <p className="text-center text-muted-foreground mt-2">
              Find local boards for pickup or shop brand new boards from verified sellers
            </p>
            <div className="flex items-center justify-center gap-3 mt-4">
              <Badge variant="outline" className="text-sm">
                <MapPin className="h-3 w-3 mr-1" />
                Local Pickup
              </Badge>
              <Badge variant="outline" className="text-sm">
                <Store className="h-3 w-3 mr-1" />
                Brand New from Shops
              </Badge>
            </div>
          </div>
        </section>

        {/* Tabs */}
        <section className="py-4">
          <div className="container mx-auto px-4">
            <Tabs defaultValue="local" className="w-full">
              <TabsList className="mb-6">
                <TabsTrigger value="local" className="gap-2">
                  <MapPin className="h-4 w-4" />
                  Local Boards
                </TabsTrigger>
                <TabsTrigger value="brand" className="gap-2">
                  <Store className="h-4 w-4" />
                  Brand New Boards
                </TabsTrigger>
              </TabsList>

              {/* Local Boards Tab */}
              <TabsContent value="local">
                {/* Filters */}
                <div className="border rounded-lg p-4 mb-6 bg-card">
                  <form className="flex flex-wrap gap-4 items-center">
                    <div className="relative flex-1 min-w-[200px]">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        name="q"
                        placeholder="Search surfboards..."
                        defaultValue={searchParams.q}
                        className="pl-10"
                      />
                    </div>

                    <div className="relative">
                      <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                      <Input
                        name="location"
                        placeholder="City or ZIP..."
                        defaultValue={searchParams.location}
                        className="pl-10 w-[150px]"
                      />
                    </div>
                    
                    <Select name="type" defaultValue={searchParams.type || "all"}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Board Type" />
                      </SelectTrigger>
                      <SelectContent>
                        {boardTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            {type.label}
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
                      <SelectTrigger className="w-[160px]">
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

                {/* Info Section */}
                <div className="mt-12 rounded-lg bg-secondary/30 p-8">
                  <div className="max-w-2xl mx-auto text-center">
                    <h2 className="text-xl font-bold mb-4">Why In-Person Only?</h2>
                    <p className="text-muted-foreground">
                      Surfboards are a personal investment. We believe you should inspect the board, 
                      check for dings, and feel the weight before you buy. Meet locally with sellers 
                      in your area to find your perfect ride.
                    </p>
                  </div>
                </div>
              </TabsContent>

              {/* Brand New Boards Tab */}
              <TabsContent value="brand">
                <ShopifyBoardsGrid />
              </TabsContent>
            </Tabs>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
