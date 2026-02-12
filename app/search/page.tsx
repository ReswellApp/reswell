import Link from "next/link"
import Image from "next/image"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCondition, formatCategory, formatBoardType } from "@/lib/listing-labels"
import { createClient } from "@/lib/supabase/server"
import { MapPin, Package } from "lucide-react"
import { SearchForm } from "./search-form"

export const metadata = {
  title: "Search - ReSwell Surf",
  description: "Search used surf gear and surfboards on ReSwell Surf.",
}

interface SearchPageProps {
  searchParams: Promise<{ q?: string }>
}

export default async function SearchPage(props: SearchPageProps) {
  const { q } = await props.searchParams
  const query = (q ?? "").trim()

  if (!query) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 py-12">
          <div className="container mx-auto px-4 max-w-2xl">
            <div className="text-center mb-10">
              <h1 className="text-3xl font-bold text-foreground mb-2">Search the marketplace</h1>
              <p className="text-muted-foreground mb-8">
                Find used gear, surfboards, wetsuits, fins, and more
              </p>
              <SearchForm initialQuery="" />
            </div>
            <div className="flex flex-wrap justify-center gap-4 text-sm">
              <Link href="/used">
                <Button variant="outline">Browse used gear</Button>
              </Link>
              <Link href="/boards">
                <Button variant="outline">Browse surfboards</Button>
              </Link>
              <Link href="/shop">
                <Button variant="outline">Shop new gear</Button>
              </Link>
            </div>
          </div>
        </main>
        <Footer />
      </div>
    )
  }

  const supabase = await createClient()

  const baseFilter = (section: string) =>
    supabase
      .from("listings")
      .select(`
        id,
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
      .or(`title.ilike.%${query}%,description.ilike.%${query}%`)
      .order("created_at", { ascending: false })
      .limit(12)

  const [usedResult, boardResult] = await Promise.all([
    baseFilter("used"),
    baseFilter("board"),
  ])

  let boardListings = boardResult.data ?? []
  if (boardListings.length === 0) {
    const surfboardsResult = await baseFilter("surfboards")
    boardListings = surfboardsResult.data ?? []
  }

  const usedListings = usedResult.data ?? []

  const hasUsed = usedListings.length > 0
  const hasBoards = boardListings.length > 0
  const hasResults = hasUsed || hasBoards

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="container mx-auto px-4">
          <div className="max-w-2xl mx-auto mb-8">
            <SearchForm initialQuery={query} />
            <p className="text-sm text-muted-foreground mt-3 text-center">
              {hasResults
                ? `Showing results for “${query}”`
                : `No listings found for "${query}"`}
            </p>
          </div>

          {!hasResults && (
            <div className="max-w-2xl mx-auto">
              <div className="text-center mb-10">
                <h1 className="text-3xl font-bold text-foreground mb-2">Search the marketplace</h1>
                <p className="text-muted-foreground mb-2">
                  Find used gear, surfboards, wetsuits, fins, and more
                </p>
                <p className="text-sm text-muted-foreground mb-8">
                  No listings found for &ldquo;{query}&rdquo;
                </p>
                <SearchForm initialQuery={query} />
              </div>
              <div className="flex flex-wrap justify-center gap-4 text-sm">
                <Link href="/used">
                  <Button variant="outline">Browse used gear</Button>
                </Link>
                <Link href="/boards">
                  <Button variant="outline">Browse surfboards</Button>
                </Link>
                <Link href="/shop">
                  <Button variant="outline">Shop new gear</Button>
                </Link>
              </div>
            </div>
          )}
          {hasResults && (
            <div className="space-y-10">
              {hasUsed && (
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
                        <Link key={listing.id} href={`/used/${listing.id}`}>
                          <Card className="group overflow-hidden hover:shadow-lg transition-shadow h-full">
                            <div className="aspect-square relative bg-muted">
                              {primaryImage?.url ? (
                                <Image
                                  src={primaryImage.url}
                                  alt={listing.title}
                                  fill
                                  className="object-cover group-hover:scale-105 transition-transform duration-300"
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
                              <h3 className="font-medium line-clamp-2">{listing.title}</h3>
                              <p className="text-xl font-bold text-primary mt-2">
                                ${Number(listing.price).toFixed(2)}
                              </p>
                              {listing.categories?.name && (
                                <Badge variant="outline" className="text-xs mt-2">
                                  {formatCategory(listing.categories.name)}
                                </Badge>
                              )}
                            </CardContent>
                          </Card>
                        </Link>
                      )
                    })}
                  </div>
                </section>
              )}

              {hasBoards && (
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
                        <Link key={listing.id} href={`/boards/${listing.id}`}>
                          <Card className="group overflow-hidden hover:shadow-lg transition-shadow h-full">
                            <div className="aspect-[4/5] relative bg-muted">
                              {primaryImage?.url ? (
                                <Image
                                  src={primaryImage.url}
                                  alt={listing.title}
                                  fill
                                  className="object-cover group-hover:scale-105 transition-transform duration-300"
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
                              <h3 className="font-medium line-clamp-2">{listing.title}</h3>
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
                          </Card>
                        </Link>
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
