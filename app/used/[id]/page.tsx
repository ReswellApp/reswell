import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Header } from "@/components/header"
import { Footer } from "@/components/footer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatCondition, formatCategory, capitalizeWords, getPublicSellerDisplayName } from "@/lib/listing-labels"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Separator } from "@/components/ui/separator"
import { createClient } from "@/lib/supabase/server"
import { ShareButton } from "@/components/share-button"
import { EndListingButton } from "@/components/end-listing-button"
import {
  ArrowLeft,
  Heart,
  MessageSquare,
  Share2,
  MapPin,
  Clock,
  Shield,
} from "lucide-react"
import { ImageGallery } from "@/components/image-gallery"
import { ContactSellerForm } from "@/components/contact-seller-form"
import { FavoriteButton } from "@/components/favorite-button"
import { TranslateableDescription } from "@/components/translateable-description"
import { findListingByParam } from "@/lib/listing-query"
export default async function UsedListingPage(props: {
  params: Promise<{ id: string }>
}) {
  const params = await props.params
  const supabase = await createClient()
  
  const { listing, redirectSlug } = await findListingByParam(
    supabase,
    params.id,
    {
      select: `
        *,
        listing_images (id, url, is_primary),
        profiles (id, display_name, avatar_url, location, created_at),
        categories (name, slug)
      `,
      section: "used",
    },
  )

  if (!listing) {
    notFound()
  }

  if (redirectSlug) {
    const { redirect } = await import("next/navigation")
    redirect(`/used/${redirectSlug}`)
  }

  // Ensure seller profile never contains private data (email, etc.) before sending to client
  const p = listing.profiles as Record<string, unknown> | null
  if (p && typeof p === "object") {
    listing.profiles = {
      id: p.id,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      location: p.location,
      created_at: p.created_at,
    }
  }

  const listingSlug = listing.slug || listing.id

  // Get seller's other listings
  const { data: sellerListings } = await supabase
    .from("listings")
    .select(`
      id,
      slug,
      title,
      price,
      listing_images (url, is_primary)
    `)
    .eq("user_id", listing.user_id)
    .eq("status", "active")
    .neq("id", listing.id)
    .limit(4)

  // Get current user
  const { data: { user } } = await supabase.auth.getUser()

  // Check if favorited
  let isFavorited = false
  if (user) {
    const { data: favorite } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("listing_id", listing.id)
      .single()
    isFavorited = !!favorite
  }

  const images = listing.listing_images?.sort((a: { is_primary: boolean }, b: { is_primary: boolean }) => 
    (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0)
  ) || []

  const isOwnListing = user?.id === listing.user_id

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      <main className="flex-1 py-8">
        <div className="container mx-auto px-4">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Link href="/used" className="hover:text-foreground flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back to Used Gear
            </Link>
            {listing.categories && (
              <>
                <span>/</span>
                <Link
                  href={`/used?category=${listing.categories.slug}`}
                  className="hover:text-foreground"
                >
                  {formatCategory(listing.categories.name)}
                </Link>
              </>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Images */}
            <div>
              <ImageGallery images={images} title={capitalizeWords(listing.title)} />
            </div>

            {/* Details */}
            <div className="space-y-4 min-w-0">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <h1 className="text-xl font-bold sm:text-2xl break-words">{capitalizeWords(listing.title)}</h1>
                  <div className="flex items-center gap-2 shrink-0">
                    <FavoriteButton
                      listingId={listing.id}
                      initialFavorited={isFavorited}
                      isLoggedIn={!!user}
                    />
                    <ShareButton title={capitalizeWords(listing.title)} />
                  </div>
                </div>
                <p className="text-2xl sm:text-3xl font-bold text-primary mt-2">
                  ${listing.price.toFixed(2)}
                </p>
              </div>

              {/* Purchase item — requires login; checkout lets user choose card, Apple Pay, or Reswell Bucks */}
              {!isOwnListing && listing.status === "active" && (
                user ? (
                  <Button size="lg" className="w-full gap-2" asChild>
                    <Link href={`/used/${listingSlug}/checkout`}>
                      Purchase item — ${listing.price.toFixed(2)}
                    </Link>
                  </Button>
                ) : (
                  <Button size="lg" className="w-full gap-2" asChild>
                    <Link href={`/used/${listingSlug}/checkout`}>
                      Add to cart
                    </Link>
                  </Button>
                )
              )}

              <p className="text-sm text-muted-foreground">
                {[
                  formatCondition(listing.condition),
                  listing.categories ? formatCategory(listing.categories.name) : null,
                ].filter(Boolean).join(" · ")}
              </p>

              {/* Description */}
              <div>
                <h2 className="font-semibold mb-2">Description</h2>
                <TranslateableDescription text={listing.description || ""} />
              </div>

              {/* Seller Info */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                    <Link
                      href={`/sellers/${listing.profiles?.id}`}
                      className="flex items-center gap-4 flex-1 min-w-0"
                    >
                      <Avatar className="h-12 w-12 shrink-0">
                        <AvatarImage src={listing.profiles?.avatar_url || ""} />
                        <AvatarFallback>
                          {getPublicSellerDisplayName(listing.profiles).charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">
                          {getPublicSellerDisplayName(listing.profiles)}
                        </p>
                        {listing.profiles?.location && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 truncate mt-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {listing.profiles.location}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3 shrink-0" />
                          Member since{" "}
                          {new Date(listing.profiles?.created_at).toLocaleDateString("en-US", {
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                      </div>
                    </Link>
                    <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto sm:shrink-0">
                      {!isOwnListing && (
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                          className="min-h-touch w-full sm:w-40 justify-center"
                        >
                          <Link
                            href={
                              user
                                ? `/messages?user=${listing.user_id}&listing=${listing.id}`
                                : `/auth/login?redirect=${encodeURIComponent(`/used/${listingSlug}`)}`
                            }
                          >
                            <MessageSquare className="h-4 w-4 mr-2" />
                            Message seller
                          </Link>
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="min-h-touch w-full sm:w-40 justify-center"
                      >
                        <Link href={`/sellers/${listing.profiles?.id}`}>
                          View Profile
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Contact Form */}
              {!isOwnListing && (
                <Card className="bg-offwhite">
                  <CardContent className="p-4">
                    <ContactSellerForm
                      listingId={listing.id}
                      listingSlug={listing.slug}
                      sellerId={listing.user_id}
                      listingTitle={capitalizeWords(listing.title)}
                      isLoggedIn={!!user}
                      section="used"
                    />
                  </CardContent>
                </Card>
              )}

              {isOwnListing && (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground mb-2">This is your listing</p>
                    <div className="flex flex-col sm:flex-row gap-2 justify-center">
                      <Button asChild>
                        <Link href={`/dashboard/listings/${listing.id}/edit`}>
                          Edit listing
                        </Link>
                      </Button>
                      <EndListingButton listingId={listing.id} />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Safety Tips */}
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Shield className="h-4 w-4 text-primary" />
                  Safety Tips
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>Coordinate shipping address and method in messages after purchase</li>
                  <li>Use secure payment methods</li>
                  <li>Report suspicious listings</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Seller's Other Listings */}
          {sellerListings && sellerListings.length > 0 && (
            <section className="mt-16">
              <h2 className="text-xl font-bold mb-6">More from this Seller</h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                {sellerListings.map((item) => {
                  const primaryImage = item.listing_images?.find((img: { is_primary: boolean }) => img.is_primary) || item.listing_images?.[0]
                  return (
                    <Link key={item.id} href={`/used/${item.slug || item.id}`}>
                      <Card className="group overflow-hidden hover:shadow-lg transition-shadow">
                        <div className="aspect-square relative bg-muted">
                          {primaryImage?.url ? (
                            <Image
                              src={primaryImage.url || "/placeholder.svg"}
                              alt={item.title}
                              fill
                              className="object-contain group-hover:scale-105 transition-transform duration-300"
                              style={{ objectFit: "contain" }}
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                              No Image
                            </div>
                          )}
                        </div>
                        <CardContent className="p-4">
                          <h3 className="font-medium line-clamp-1">{item.title}</h3>
                          <p className="text-lg font-bold text-primary mt-1">
                            ${item.price.toFixed(2)}
                          </p>
                        </CardContent>
                      </Card>
                    </Link>
                  )
                })}
              </div>
            </section>
          )}
        </div>
      </main>

      <Footer />
    </div>
  )
}
