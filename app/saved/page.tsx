import { Suspense, redirect } from "react"
import Link from "next/link"
import Image from "next/image"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCondition, formatCategory, formatBoardType, capitalizeWords, getPublicSellerDisplayName } from "@/lib/listing-labels"
import { createClient } from "@/lib/supabase/server"
import { MessageListingButton } from "@/components/message-listing-button"
import { Heart, MapPin, Package } from "lucide-react"

interface SearchParams {
  page?: string
}

async function SavedListings({ searchParams }: { searchParams: SearchParams }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    redirect("/auth/login?redirect=/saved")
  }

  const page = parseInt(searchParams.page || "1")
  const limit = 12
  const offset = (page - 1) * limit

  const { data: allFavorites } = await supabase
    .from("favorites")
    .select(
      `
      id,
      created_at,
      listing:listings(
        id,
        user_id,
        title,
        price,
        condition,
        status,
        section,
        city,
        state,
        board_type,
        listing_images(url, is_primary),
        profiles(display_name, avatar_url),
        categories(name, slug)
      )
    `
    )
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  // Filter to only active listings
  const activeFavorites = (allFavorites || []).filter(
    (f: any) => f.listing && f.listing.status === "active"
  )

  const totalCount = activeFavorites.length
  const favorites = activeFavorites.slice(offset, offset + limit)
  const totalPages = Math.ceil(totalCount / limit)

  function pageUrl(pageNum: number) {
    const params = new URLSearchParams()
    if (pageNum > 1) params.set("page", String(pageNum))
    return `/saved${params.toString() ? `?${params.toString()}` : ""}`
  }

  function getListingHref(listing: any) {
    switch (listing.section) {
      case "used":
        return `/used/${listing.id}`
      case "new":
        return `/shop/${listing.id}`
      case "surfboards":
        return `/boards/${listing.id}`
      default:
        return `/used/${listing.id}`
    }
  }

  function getSectionLabel(section: string) {
    switch (section) {
      case "used":
        return "Used Gear"
      case "new":
        return "New Items"
      case "surfboards":
        return "Surfboards"
      default:
        return section
    }
  }

  if (!favorites || favorites.length === 0) {
    return (
      <div className="text-center py-16">
        <Heart className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
        <h2 className="text-2xl font-bold text-foreground mb-2">No saved items yet</h2>
        <p className="text-muted-foreground mb-6">
          Start saving items you love to see them here
        </p>
        <div className="flex gap-4 justify-center">
          <Button asChild>
            <Link href="/used">Browse Used Gear</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/boards">Browse Surfboards</Link>
          </Button>
        </div>
      </div>
    )
  }

  return (
    <>
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {favorites.map((favorite: any) => {
          const listing = favorite.listing
          if (!listing) return null

          const primaryImage =
            listing.listing_images?.find((img: { is_primary: boolean }) => img.is_primary) ||
            listing.listing_images?.[0]

          return (
            <Card key={favorite.id} className="group overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col">
              <Link href={getListingHref(listing)} className="flex-1 flex flex-col">
                <div className={`aspect-square relative bg-muted ${listing.section === "surfboards" ? "aspect-[4/5]" : ""}`}>
                  {primaryImage?.url ? (
                    <Image
                      src={primaryImage.url || "/placeholder.svg"}
                      alt={capitalizeWords(listing.title)}
                      fill
                      className="object-contain group-hover:scale-105 transition-transform duration-300"
                      style={{ objectFit: "contain" }}
                    />
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                      No Image
                    </div>
                  )}
                  <div className="absolute top-2 left-2 flex flex-col gap-1">
                    {listing.condition && (
                      <Badge variant="secondary">{formatCondition(listing.condition)}</Badge>
                    )}
                    {listing.board_type && (
                      <Badge variant="outline" className="bg-background/80">
                        {formatBoardType(listing.board_type)}
                      </Badge>
                    )}
                    {listing.categories?.name && !listing.board_type && (
                      <Badge variant="outline" className="bg-background/80 text-xs">
                        {formatCategory(listing.categories.name)}
                      </Badge>
                    )}
                  </div>
                  {listing.section === "surfboards" && (
                    <Badge className="absolute bottom-2 right-2 bg-background/80 text-foreground">
                      <MapPin className="h-3 w-3 mr-1" />
                      In-Person Only
                    </Badge>
                  )}
                  {listing.section === "new" && (
                    <Badge className="absolute bottom-2 right-2 bg-background/80 text-foreground">
                      <Package className="h-3 w-3 mr-1" />
                      New
                    </Badge>
                  )}
                </div>
                <CardContent className="p-4">
                  <h3 className="font-medium line-clamp-2">{capitalizeWords(listing.title)}</h3>
                  <p className="text-xl font-bold text-primary mt-2">${listing.price.toFixed(2)}</p>
                  <div className="flex items-center justify-between mt-2">
                    <p className="text-sm text-muted-foreground">
                      {getPublicSellerDisplayName(listing.profiles)}
                    </p>
                    <Badge variant="outline" className="text-xs">
                      {getSectionLabel(listing.section)}
                    </Badge>
                  </div>
                  {listing.city && listing.state && (
                    <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {listing.city}, {listing.state}
                    </p>
                  )}
                </CardContent>
              </Link>
              <div className="px-4 pb-4 pt-0">
                <MessageListingButton
                  listingId={listing.id}
                  sellerId={listing.user_id}
                  redirectPath={getListingHref(listing)}
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

export default async function SavedPage(props: { searchParams: Promise<SearchParams> }) {
  const searchParams = await props.searchParams

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Hero */}
        <section className="bg-offwhite py-12">
          <div className="container mx-auto px-4">
            <h1 className="text-3xl font-bold text-center">Saved Items</h1>
            <p className="text-center text-muted-foreground mt-2">
              Your collection of favorite gear and boards
            </p>
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
              <SavedListings searchParams={searchParams} />
            </Suspense>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
