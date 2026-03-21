import Link from "next/link"
import Image from "next/image"
import { notFound } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatCondition, formatCategory, capitalizeWords } from "@/lib/listing-labels"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import {
  MapPin,
  Phone,
  Globe,
  Star,
  MessageSquare,
  Calendar,
  Package,
  ArrowLeft,
} from "lucide-react"
import { MessageListingButton } from "@/components/message-listing-button"
import { FavoriteButtonCardOverlay } from "@/components/favorite-button-card-overlay"
import { VerifiedBadge } from "@/components/verified-badge"

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()
  const { data: shop } = await supabase
    .from("profiles")
    .select("shop_name, display_name, shop_description")
    .eq("id", id)
    .single()

  return {
    title: shop
? `${shop.shop_name || shop.display_name} - Reswell`
  : "Seller - Reswell",
    description: shop?.shop_description || "View this seller on Reswell.",
  }
}

export default async function SellerProfilePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const supabase = await createClient()

  // Fetch the shop profile (public fields only; never expose email or role flags)
  const { data: shop, error } = await supabase
    .from("profiles")
    .select(
      "id, display_name, avatar_url, location, city, bio, created_at, updated_at, is_shop, shop_name, shop_description, shop_banner_url, shop_logo_url, shop_verified, shop_website, shop_phone, shop_address, sales_count"
    )
    .eq("id", id)
    .single()

  if (error || !shop) {
    notFound()
  }

  // Fetch ALL of the seller's listings (current + past)
  const { data: listings } = await supabase
    .from("listings")
    .select(
      `
      *,
      listing_images (url, is_primary),
      categories (name, slug)
    `
    )
    .eq("user_id", id)
    .order("created_at", { ascending: false })

  // Fetch reviews (for stats + list)
  const { data: reviews } = await supabase
    .from("reviews")
    .select("id, rating, comment, created_at")
    .eq("reviewed_id", id)
    .order("created_at", { ascending: false })

  const avgRating =
    reviews && reviews.length > 0
      ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
      : 0
  const reviewCount = reviews?.length || 0

  const { data: { user } } = await supabase.auth.getUser()
  let favoritedIds: string[] = []
  if (user && listings && listings.length > 0) {
    const { data: favs } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .in("listing_id", listings.map((l: any) => l.id))
    favoritedIds = (favs ?? []).map((f) => f.listing_id)
  }

  const allListings = listings || []
  const currentListings = allListings.filter(
    (l) => l.status === "active" && !l.archived_at
  )
  const pastListings = allListings.filter(
    (l) => l.status !== "active" || l.archived_at
  )

  const usedListings = currentListings.filter((l) => l.section === "used")
  const newListings = currentListings.filter((l) => l.section === "new")
  const boardListings = currentListings.filter(
    (l) => l.section === "surfboards"
  )
  const totalListings = allListings.length

  const isShop = shop.is_shop
  const displayName = isShop
    ? shop.shop_name || shop.display_name
    : shop.display_name

  return (
    <div className="min-h-screen flex flex-col">
      <Header />

      <main className="flex-1">
        {/* Banner */}
        <div className="relative h-40 sm:h-56 bg-offwhite">
          {shop.shop_banner_url && (
            <img
              src={shop.shop_banner_url || "/placeholder.svg"}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
            />
          )}
        </div>

        {/* Profile Header */}
        <div className="container mx-auto">
          <div className="relative -mt-12 mb-8">
            <div className="flex flex-col sm:flex-row items-start gap-4 sm:gap-6">
              <Avatar className="h-24 w-24 border-4 border-background shadow-lg">
                <AvatarImage
                  src={
                    (isShop ? shop.shop_logo_url : shop.avatar_url) || ""
                  }
                />
                <AvatarFallback className="text-2xl bg-primary text-primary-foreground">
                  {displayName?.charAt(0).toUpperCase() || "S"}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 pt-2">
                <div className="flex flex-wrap items-center gap-2">
                  <h1 className="text-2xl font-bold text-foreground">
                    {displayName}
                  </h1>
                  {shop.shop_verified && (
                    <Badge className="bg-blue-50 text-blue-600 border-blue-200 hover:bg-blue-100">
                      <VerifiedBadge size="sm" className="mr-1" />
                      Verified Seller
                    </Badge>
                  )}
                  {isShop && !shop.shop_verified && (
                    <Badge variant="secondary">Seller</Badge>
                  )}
                </div>

                {/* Stats row */}
                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-muted-foreground">
                  {(shop.city || shop.shop_address) && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {shop.shop_address || shop.city}
                    </span>
                  )}
                  {reviewCount > 0 && (
                    <span className="flex items-center gap-1">
                      <Star className="h-3.5 w-3.5 fill-accent text-accent" />
                      {avgRating.toFixed(1)} ({reviewCount} review
                      {reviewCount !== 1 ? "s" : ""})
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <Package className="h-3.5 w-3.5" />
                    {totalListings} listing{totalListings !== 1 ? "s" : ""} total
                  </span>
                  <span className="flex items-center gap-1">
                    <Calendar className="h-3.5 w-3.5" />
                    Joined{" "}
                    {new Date(shop.created_at).toLocaleDateString("en-US", {
                      month: "short",
                      year: "numeric",
                    })}
                  </span>
                </div>

                {/* Description */}
                {(shop.shop_description || shop.bio) && (
                  <p className="mt-3 text-sm text-muted-foreground max-w-2xl">
                    {shop.shop_description || shop.bio}
                  </p>
                )}

                {/* Contact info */}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  {shop.shop_website && (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={shop.shop_website}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Globe className="mr-1.5 h-3.5 w-3.5" />
                        Website
                      </a>
                    </Button>
                  )}
                  {shop.shop_phone && (
                    <Button variant="outline" size="sm" asChild>
                      <a href={`tel:${shop.shop_phone}`}>
                        <Phone className="mr-1.5 h-3.5 w-3.5" />
                        {shop.shop_phone}
                      </a>
                    </Button>
                  )}
                  <Button variant="outline" size="sm" asChild>
                    <Link href={`/messages?seller=${shop.id}`}>
                      <MessageSquare className="mr-1.5 h-3.5 w-3.5" />
                      Contact
                    </Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Buyer reviews (directly under contact) */}
          <div className="py-6">
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Star className="h-4 w-4 text-accent" />
              Buyer reviews
            </h2>
            {reviews && reviews.length > 0 ? (
              <div className="space-y-4">
                {reviews.map((review) => (
                  <Card key={review.id}>
                    <CardContent className="py-3 px-4">
                      <div className="flex items-center gap-2 text-sm mb-1">
                        <span className="font-medium">Rating:</span>
                        <span className="text-accent font-semibold">
                          {review.rating}/5
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto">
                          {review.created_at
                            ? new Date(review.created_at).toLocaleDateString(
                                "en-US",
                                { month: "short", day: "numeric", year: "numeric" }
                              )
                            : null}
                        </span>
                      </div>
                      {review.comment && (
                        <p className="text-sm text-muted-foreground">
                          {review.comment}
                        </p>
                      )}
                      {!review.comment && (
                        <p className="text-sm text-muted-foreground italic">
                          No written comment provided.
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No reviews yet.
              </p>
            )}
          </div>

          <Separator />

          {/* Current listings tabs */}
          <div className="py-8">
            <Tabs defaultValue="all">
              <TabsList>
                <TabsTrigger value="all">
                  Current ({currentListings.length})
                </TabsTrigger>
                {usedListings.length > 0 && (
                  <TabsTrigger value="used">
                    Used ({usedListings.length})
                  </TabsTrigger>
                )}
                {newListings.length > 0 && (
                  <TabsTrigger value="new">
                    New ({newListings.length})
                  </TabsTrigger>
                )}
                {boardListings.length > 0 && (
                  <TabsTrigger value="boards">
                    Boards ({boardListings.length})
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="all" className="mt-6">
                <ListingGrid listings={currentListings} favoritedIds={favoritedIds} isLoggedIn={!!user} />
              </TabsContent>
              <TabsContent value="used" className="mt-6">
                <ListingGrid listings={usedListings} favoritedIds={favoritedIds} isLoggedIn={!!user} />
              </TabsContent>
              <TabsContent value="new" className="mt-6">
                <ListingGrid listings={newListings} favoritedIds={favoritedIds} isLoggedIn={!!user} />
              </TabsContent>
              <TabsContent value="boards" className="mt-6">
                <ListingGrid listings={boardListings} favoritedIds={favoritedIds} isLoggedIn={!!user} />
              </TabsContent>
            </Tabs>
          </div>

          {/* Past / sold listings */}
          {pastListings.length > 0 && (
            <div className="py-4 border-t border-border">
              <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
                <Package className="h-4 w-4" />
                Previous &amp; sold listings
                <span className="text-xs font-normal text-muted-foreground">
                  ({pastListings.length})
                </span>
              </h2>
              <ListingGrid listings={pastListings} favoritedIds={favoritedIds} isLoggedIn={!!user} />
            </div>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}

function ListingGrid({ listings, favoritedIds, isLoggedIn }: { listings: any[]; favoritedIds: string[]; isLoggedIn: boolean }) {
  if (listings.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-2 text-muted-foreground">No listings in this category</p>
      </div>
    )
  }

  function getListingHref(listing: any) {
    const id = listing.slug || listing.id
    switch (listing.section) {
      case "used":
        return `/used/${id}`
      case "new":
        return `/shop/${listing.id}`
      case "surfboards":
        return `/boards/${id}`
      default:
        return `/used/${id}`
    }
  }

  return (
    <div className="grid gap-6 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
      {listings.map((listing) => {
        const primaryImage = listing.listing_images?.find(
          (img: any) => img.is_primary
        ) || listing.listing_images?.[0]

        return (
          <Card key={listing.id} className="group overflow-hidden hover:shadow-lg transition-shadow h-full flex flex-col">
            <Link href={getListingHref(listing)} className="flex-1 flex flex-col">
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
                  isLoggedIn={isLoggedIn}
                />
              </div>
              <CardContent className="p-4">
                <h3 className="font-medium line-clamp-2">{capitalizeWords(listing.title)}</h3>
                <p className="text-xl font-bold text-primary mt-2">
                  ${Number(listing.price).toFixed(2)}
                </p>
                {listing.status && listing.status !== "active" && (
                  <p className="mt-1 text-sm font-medium text-muted-foreground">
                    {listing.status === "sold"
                      ? "Sold"
                      : listing.status === "pending"
                        ? "Pending"
                        : "Ended"}
                  </p>
                )}
                {listing.city && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground mt-2">
                    <MapPin className="h-3 w-3" />
                    {listing.city}
                    {listing.state ? `, ${listing.state}` : ""}
                  </div>
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
  )
}
