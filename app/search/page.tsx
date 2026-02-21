import Link from "next/link"
import Image from "next/image"
import { redirect } from "next/navigation"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCondition, formatCategory, formatBoardType, capitalizeWords } from "@/lib/listing-labels"
import { createClient } from "@/lib/supabase/server"
import { MapPin, Package } from "lucide-react"
import { SearchResultsBar } from "./search-results-bar"
import { MessageListingButton } from "@/components/message-listing-button"

export const metadata = {
  title: "Search - ReSwell Surf",
  description: "Search used surf gear and surfboards on ReSwell Surf.",
}

type SectionFilter = "all" | "used" | "boards"

interface SearchPageProps {
  searchParams: Promise<{ q?: string; section?: string }>
}

export default async function SearchPage(props: SearchPageProps) {
  const { q, section: sectionParam } = await props.searchParams
  const query = (q ?? "").trim()
  const section: SectionFilter =
    sectionParam === "used" || sectionParam === "boards" ? sectionParam : "all"

  if (!query) redirect("/")

  let usedListings: any[] = []
  let boardListings: any[] = []
  let hasUsed = false
  let hasBoards = false

  if (query) {
    const supabase = await createClient()

    const escaped = query.replace(/\\/g, "\\\\").replace(/"/g, '\\"')
    const pattern = `"%${escaped}%"`

    const [usedCatRes, boardsCatRes] = await Promise.all([
      supabase.from("categories").select("id").eq("section", "used").or(`name.ilike.${pattern},slug.ilike.${pattern}`),
      supabase.from("categories").select("id").eq("section", "surfboards").or(`name.ilike.${pattern},slug.ilike.${pattern}`),
    ])
    const usedCategoryIds = (usedCatRes.data ?? []).map((c) => c.id)
    const boardsCategoryIds = (boardsCatRes.data ?? []).map((c) => c.id)

    const baseFilter = (section: string, categoryIds: string[]) => {
      const orParts = [`title.ilike.${pattern}`, `description.ilike.${pattern}`]
      if (categoryIds.length > 0) orParts.push(`category_id.in.(${categoryIds.join(",")})`)
      return supabase
        .from("listings")
        .select(`
          id,
          user_id,
          title,
          price,
          condition,
          section,
          city,
          state,
          board_type,
          listing_images (url, is_primary),
          profiles (display_name, avatar_url),
          categories (name, slug)
        `)
        .eq("status", "active")
        .eq("section", section)
        .or(orParts.join(","))
        .order("created_at", { ascending: false })
        .limit(12)
    }

    const [usedResult, boardResult] = await Promise.all([
      baseFilter("used", usedCategoryIds),
      baseFilter("surfboards", boardsCategoryIds),
    ])

    boardListings = boardResult.data ?? []
    if (boardListings.length === 0) {
      const surfboardsResult = await baseFilter("surfboards", boardsCategoryIds)
      boardListings = surfboardsResult.data ?? []
    }

    usedListings = usedResult.data ?? []
    hasUsed = usedListings.length > 0
    hasBoards = boardListings.length > 0
  }

  const hasResults = hasUsed || hasBoards

  const showUsed = section === "all" || section === "used"
  const showBoards = section === "all" || section === "boards"

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1">
        <SearchResultsBar
          query={query}
          section={section}
          usedCount={usedListings.length}
          boardsCount={boardListings.length}
        />
        <div className="container mx-auto max-w-3xl px-4 py-12 sm:py-16 md:py-20">
          {!hasResults && (
            <div className="rounded-2xl border border-border bg-card px-8 py-12 shadow-sm sm:px-12 sm:py-16">
              <p className="text-center text-base text-muted-foreground sm:text-lg">
                No listings found for &ldquo;{query}&rdquo;. Try a different term or browse by category.
              </p>
              <div className="mt-10 flex flex-wrap justify-center gap-4 sm:gap-5">
                <Link href="/used">
                  <Button variant="outline" size="lg" className="rounded-xl border-border px-8 font-medium">
                    Browse used gear
                  </Button>
                </Link>
                <Link href="/boards">
                  <Button variant="outline" size="lg" className="rounded-xl border-border px-8 font-medium">
                    Browse surfboards
                  </Button>
                </Link>
                <Link href="/shop">
                  <Button variant="outline" size="lg" className="rounded-xl border-border px-8 font-medium">
                    Shop new gear
                  </Button>
                </Link>
              </div>
            </div>
          )}
          {hasResults && (
            <div className="space-y-10">
              {showUsed && hasUsed && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-foreground">Used gear</h2>
                    <Link
                      href={`/used?q=${encodeURIComponent(query)}`}
                      className="text-sm text-primary hover:underline"
                    >
                      View all in used gear →
                    </Link>
                  </div>
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {usedListings.map((listing: any) => {
                      const primaryImage = listing.listing_images?.find((img: any) => img.is_primary) || listing.listing_images?.[0]
                      return (
                        <Card key={listing.id} className="group overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col">
                          <Link href={`/used/${listing.id}`} className="flex-1 flex flex-col">
                            <div className="aspect-square relative bg-muted">
                              {primaryImage?.url ? (
                                <Image
                                  src={primaryImage.url}
                                  alt={capitalizeWords(listing.title)}
                                  fill
                                  className="object-contain group-hover:scale-105 transition-transform duration-300"
                                  style={{ objectFit: "contain" }}
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                  <Package className="h-10 w-10" />
                                </div>
                              )}
                              <Badge className="absolute top-2 left-2" variant="secondary">
                                {formatCondition(listing.condition)}
                              </Badge>
                            </div>
                            <CardContent className="p-4">
                              <h3 className="font-medium line-clamp-2">{capitalizeWords(listing.title)}</h3>
                              <p className="text-xl font-bold text-primary mt-2">
                                ${Number(listing.price).toFixed(2)}
                              </p>
                              {listing.categories?.name && (
                                <Badge variant="outline" className="text-xs mt-2">
                                  {formatCategory(listing.categories.name)}
                                </Badge>
                              )}
                            </CardContent>
                          </Link>
                          <div className="px-4 pb-4 pt-0">
                            <MessageListingButton
                              listingId={listing.id}
                              sellerId={listing.user_id}
                              redirectPath={`/used/${listing.id}`}
                            />
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                </section>
              )}

              {showBoards && hasBoards && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xl font-semibold text-foreground">Surfboards</h2>
                    <Link
                      href={`/boards?q=${encodeURIComponent(query)}`}
                      className="text-sm text-primary hover:underline"
                    >
                      View all in surfboards →
                    </Link>
                  </div>
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {boardListings.map((listing: any) => {
                      const primaryImage = listing.listing_images?.find((img: any) => img.is_primary) || listing.listing_images?.[0]
                      return (
                        <Card key={listing.id} className="group overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col">
                          <Link href={`/boards/${listing.id}`} className="flex-1 flex flex-col">
                            <div className="aspect-[4/5] relative bg-muted">
                              {primaryImage?.url ? (
                                <Image
                                  src={primaryImage.url}
                                  alt={capitalizeWords(listing.title)}
                                  fill
                                  className="object-contain group-hover:scale-105 transition-transform duration-300"
                                  style={{ objectFit: "contain" }}
                                />
                              ) : (
                                <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                                  <Package className="h-10 w-10" />
                                </div>
                              )}
                              <Badge className="absolute top-2 left-2" variant="secondary">
                                {formatCondition(listing.condition)}
                              </Badge>
                              {listing.board_type && (
                                <Badge className="absolute top-2 right-2" variant="outline">
                                  {formatBoardType(listing.board_type)}
                                </Badge>
                              )}
                            </div>
                            <CardContent className="p-4">
                              <h3 className="font-medium line-clamp-2">{capitalizeWords(listing.title)}</h3>
                              <p className="text-xl font-bold text-primary mt-2">
                                ${Number(listing.price).toFixed(2)}
                              </p>
                              {(listing.city || listing.state) && (
                                <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1">
                                  <MapPin className="h-3 w-3" />
                                  {[listing.city, listing.state].filter(Boolean).join(", ")}
                                </p>
                              )}
                            </CardContent>
                          </Link>
                          <div className="px-4 pb-4 pt-0">
                            <MessageListingButton
                              listingId={listing.id}
                              sellerId={listing.user_id}
                              redirectPath={`/boards/${listing.id}`}
                            />
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                </section>
              )}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  )
}
