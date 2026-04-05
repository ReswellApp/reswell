import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  formatCondition,
  formatCategory,
  capitalizeWords,
  getPublicSellerDisplayName,
} from "@/lib/listing-labels"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { createClient } from "@/lib/supabase/server"
import { ShareButton } from "@/components/share-button"
import { EndListingButton } from "@/components/end-listing-button"
import { ArrowLeft, MessageSquare, MapPin, Clock, Shield } from "lucide-react"
import dynamic from "next/dynamic"
import { ListingPhotosPendingBanner } from "@/components/listing-photos-pending-banner"
import { ContactSellerForm } from "@/components/contact-seller-form"
import { FavoriteButton } from "@/components/favorite-button"
import { TranslateableDescription } from "@/components/translateable-description"
import { findListingByParam } from "@/lib/listing-query"
import { VerifiedBadge } from "@/components/verified-badge"
import { ListingSellerStats } from "@/components/listing-seller-stats"
import { wetsuitZipLabel } from "@/lib/wetsuit-options"
import { leashLengthLabel } from "@/lib/leash-options"
import {
  collectibleTypeLabel,
  collectibleEraLabel,
  collectibleConditionLabel,
} from "@/lib/collectible-options"
import { boardFulfillmentSummary } from "@/lib/listing-fulfillment"
import { ListingTile } from "@/components/listing-tile"
import { listingProductCardGridClassName } from "@/lib/listing-card-styles"
import { Truck } from "lucide-react"
import {
  ListingSoldDetailNotice,
  ListingSoldOwnerNotice,
} from "@/components/listing-sold-detail-notice"
import { listingDetailHref } from "@/lib/listing-href"
import { sellerProfileHref } from "@/lib/seller-slug"

const ImageGallery = dynamic(
  () => import("@/components/image-gallery").then((m) => ({ default: m.ImageGallery })),
  {
    loading: () => (
      <div
        className="relative w-full rounded-lg overflow-hidden bg-muted"
        style={{ paddingBottom: "133.33%" }}
      />
    ),
  },
)

export async function UsedListingDetailPage({
  listing: listingParam,
}: {
  listing: string
}) {
  const supabase = await createClient()

  const { listing } = await findListingByParam(supabase, listingParam, {
    select: `
        *,
        listing_images (id, url, is_primary, sort_order),
        profiles (id, seller_slug, is_shop, shop_name, display_name, avatar_url, location, created_at, shop_verified, sales_count),
        categories (name, slug)
      `,
    section: "used",
  })

  if (!listing) {
    notFound()
  }

  const p = listing.profiles as Record<string, unknown> | null
  if (p && typeof p === "object") {
    listing.profiles = {
      id: p.id,
      seller_slug: p.seller_slug,
      is_shop: p.is_shop,
      shop_name: p.shop_name,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      location: p.location,
      created_at: p.created_at,
      shop_verified: p.shop_verified,
      sales_count: p.sales_count,
    }
  }

  const { data: sellerReviewRatings } = await supabase
    .from("reviews")
    .select("rating")
    .eq("reviewed_id", listing.user_id)

  const reviewRatings = (sellerReviewRatings ?? []).map((r) => r.rating)
  const sellerReviewCount = reviewRatings.length
  const sellerAvgRating =
    sellerReviewCount > 0
      ? reviewRatings.reduce((sum, r) => sum + r, 0) / sellerReviewCount
      : 0

  const { data: sellerListings } = await supabase
    .from("listings")
    .select(`
      id,
      slug,
      title,
      price,
      listing_images (url, is_primary),
      categories (slug)
    `)
    .eq("user_id", listing.user_id)
    .eq("status", "active")
    .eq("section", "used")
    .neq("id", listing.id)
    .limit(4)

  const {
    data: { user },
  } = await supabase.auth.getUser()

  let isFavorited = false
  let sellerListingFavIds: string[] = []
  if (user) {
    const { data: favorite } = await supabase
      .from("favorites")
      .select("id")
      .eq("user_id", user.id)
      .eq("listing_id", listing.id)
      .single()
    isFavorited = !!favorite

    if (sellerListings && sellerListings.length > 0) {
      const { data: sellerFavs } = await supabase
        .from("favorites")
        .select("listing_id")
        .eq("user_id", user.id)
        .in("listing_id", sellerListings.map((l) => l.id))
      sellerListingFavIds = (sellerFavs ?? []).map((f) => f.listing_id)
    }
  }

  const images =
    listing.listing_images?.sort(
      (
        a: { is_primary: boolean; sort_order?: number },
        b: { is_primary: boolean; sort_order?: number },
      ) =>
        (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) ||
        (a.sort_order ?? 0) - (b.sort_order ?? 0),
    ) || []

  const isOwnListing = user?.id === listing.user_id
  const isSold = listing.status === "sold"
  const pickupOffered = listing.local_pickup !== false
  const shippingOffered = !!listing.shipping_available
  const shippingPrice = Math.max(0, parseFloat(String(listing.shipping_price ?? 0)) || 0)

  const pickupCity = listing.profiles?.location
    ? (listing.profiles.location as string).split(",")[0]?.trim()
    : null

  const categorySlug = listing.categories?.slug ?? null
  const categoryBrowseHref =
    categorySlug && categorySlug.length > 0 ? `/${categorySlug}` : null

  return (
    <main className="flex-1 py-8">
      <div className="container mx-auto">
        {listing.categories && categoryBrowseHref && (
          <nav className="mb-6" aria-label="Listing category">
            <Link
              href={categoryBrowseHref}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              <ArrowLeft className="h-4 w-4 shrink-0" />
              {formatCategory(listing.categories.name)}
            </Link>
          </nav>
        )}

        {isSold && (
          <div className="max-w-5xl mx-auto mb-6">
            <ListingSoldDetailNotice />
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
          <div>
            {!(isSold && isOwnListing) && (
              <ListingPhotosPendingBanner imageCount={images.length} isOwner={isOwnListing} />
            )}
            <ImageGallery
              images={images}
              title={capitalizeWords(listing.title)}
              sold={isSold}
            />
          </div>

          <div className="space-y-4 min-w-0">
            <div>
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                <h1 className="text-xl font-bold sm:text-2xl break-words">
                  {capitalizeWords(listing.title)}
                </h1>
                <div className="flex items-center gap-2 shrink-0">
                  <FavoriteButton
                    listingId={listing.id}
                    initialFavorited={isFavorited}
                    isLoggedIn={!!user}
                  />
                  <ShareButton title={capitalizeWords(listing.title)} />
                </div>
              </div>
              {isSold ? (
                <p className="text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                  Sold for ${listing.price.toFixed(2)}
                </p>
              ) : (
                <p className="text-2xl sm:text-3xl font-bold text-black dark:text-white mt-2">
                  ${listing.price.toFixed(2)}
                </p>
              )}
            </div>

            <p className="text-sm text-muted-foreground">
              {[
                formatCondition(listing.condition),
                listing.categories ? formatCategory(listing.categories.name) : null,
                boardFulfillmentSummary(listing.local_pickup, listing.shipping_available),
              ]
                .filter(Boolean)
                .join(" · ")}
            </p>
            {shippingOffered && (
              <p className="text-sm font-medium text-neutral-900 flex items-center gap-1.5">
                <Truck className="h-4 w-4" />
                {shippingPrice === 0 ? "Free shipping" : `+$${shippingPrice.toFixed(2)} shipping`}
              </p>
            )}
            {listing.categories?.slug === "wetsuits" &&
              ((listing as { wetsuit_size?: string | null }).wetsuit_size ||
                (listing as { wetsuit_thickness?: string | null }).wetsuit_thickness ||
                (listing as { wetsuit_zip_type?: string | null }).wetsuit_zip_type) && (
                <p className="text-sm text-muted-foreground">
                  {[
                    (listing as { wetsuit_size?: string | null }).wetsuit_size?.trim(),
                    (listing as { wetsuit_thickness?: string | null }).wetsuit_thickness?.trim(),
                    (listing as { wetsuit_zip_type?: string | null }).wetsuit_zip_type?.trim()
                      ? wetsuitZipLabel(
                          (listing as { wetsuit_zip_type: string }).wetsuit_zip_type.trim(),
                        )
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            {listing.categories?.slug === "leashes" &&
              ((listing as { leash_length?: string | null }).leash_length ||
                (listing as { leash_thickness?: string | null }).leash_thickness) && (
                <p className="text-sm text-muted-foreground">
                  {[
                    (listing as { leash_length?: string | null }).leash_length?.trim()
                      ? leashLengthLabel(
                          (listing as { leash_length: string }).leash_length.trim(),
                        )
                      : null,
                    (listing as { leash_thickness?: string | null }).leash_thickness?.trim(),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}
            {listing.categories?.slug === "collectibles-vintage" &&
              ((listing as { collectible_type?: string | null }).collectible_type ||
                (listing as { collectible_era?: string | null }).collectible_era ||
                (listing as { collectible_condition?: string | null }).collectible_condition) && (
                <p className="text-sm text-muted-foreground">
                  {[
                    (listing as { collectible_type?: string | null }).collectible_type?.trim()
                      ? collectibleTypeLabel(
                          (listing as { collectible_type: string }).collectible_type.trim(),
                        )
                      : null,
                    (listing as { collectible_era?: string | null }).collectible_era?.trim()
                      ? collectibleEraLabel(
                          (listing as { collectible_era: string }).collectible_era.trim(),
                        )
                      : null,
                    (listing as { collectible_condition?: string | null }).collectible_condition?.trim()
                      ? collectibleConditionLabel(
                          (listing as { collectible_condition: string }).collectible_condition.trim(),
                        )
                      : null,
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>
              )}

            <div>
              <h2 className="font-semibold mb-2">Description</h2>
              <TranslateableDescription text={listing.description || ""} />
            </div>

            <Card>
              <CardContent className="p-4">
                <div className="flex flex-col gap-4">
                  <Link
                    href={sellerProfileHref(listing.profiles)}
                    className="flex items-center gap-4"
                  >
                    <Avatar className="h-12 w-12 shrink-0">
                      <AvatarImage src={listing.profiles?.avatar_url || ""} />
                      <AvatarFallback>
                        {getPublicSellerDisplayName(listing.profiles).charAt(0).toUpperCase() || "U"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium flex items-center gap-1">
                        {getPublicSellerDisplayName(listing.profiles)}
                        {listing.profiles?.shop_verified && <VerifiedBadge size="sm" />}
                      </p>
                      {listing.profiles?.location && (
                        <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
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
                      <ListingSellerStats
                        avgRating={sellerAvgRating}
                        reviewCount={sellerReviewCount}
                        itemsSold={Number(listing.profiles?.sales_count ?? 0)}
                        className="text-xs sm:text-sm"
                      />
                    </div>
                  </Link>
                  {!isOwnListing && !isSold && (
                    <div className="flex flex-row gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="min-h-touch flex-1 justify-center"
                      >
                        <Link
                          href={
                            user
                              ? `/messages?user=${listing.user_id}&listing=${listing.id}`
                              : `/auth/login?redirect=${encodeURIComponent(
                                  listingDetailHref({
                                    id: listing.id,
                                    slug: listing.slug,
                                    section: "used",
                                    categories: listing.categories as { slug?: string | null } | null,
                                  }),
                                )}`
                          }
                        >
                          <MessageSquare className="h-4 w-4 mr-2" />
                          Message seller
                        </Link>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                        className="min-h-touch flex-1 justify-center"
                      >
                        <Link href={sellerProfileHref(listing.profiles)}>View Profile</Link>
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {!isOwnListing && !isSold && (
              <Card className="bg-offwhite">
                <CardContent className="p-4">
                  <ContactSellerForm
                    listingId={listing.id}
                    listingSlug={listing.slug}
                    sellerId={listing.user_id}
                    listingTitle={capitalizeWords(listing.title)}
                    isLoggedIn={!!user}
                    section="used"
                    shippingAvailable={shippingOffered}
                  />
                </CardContent>
              </Card>
            )}

            {isOwnListing && isSold && (
              <Card className="bg-muted/20 border-border">
                <CardContent className="p-4">
                  <ListingSoldOwnerNotice
                    dashboardListingsHref="/dashboard/listings"
                    sectionLabel="listing"
                  />
                </CardContent>
              </Card>
            )}

            {isOwnListing && !isSold && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4 text-center">
                  <p className="text-sm text-muted-foreground mb-2">This is your listing</p>
                  <div className="flex flex-col sm:flex-row gap-2 justify-center">
                    <Button asChild>
                      <Link href={`/dashboard/listings/${listing.id}/edit`}>Edit listing</Link>
                    </Button>
                    <EndListingButton listingId={listing.id} />
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="bg-muted/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-sm font-medium mb-2">
                <Shield className="h-4 w-4 text-primary" />
                Safety Tips
              </div>
              <ul className="text-xs text-muted-foreground space-y-1">
                <li>Coordinate shipping address and method in messages after purchase</li>
                <li>Use secure payment methods</li>
                <li>See our <Link href="/safety" className="underline">safety tips</Link> if something feels off</li>
              </ul>
            </div>
          </div>
        </div>

        {sellerListings && sellerListings.length > 0 && (
          <section className="mt-16">
            <h2 className="text-xl font-bold mb-6">More from this Seller</h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
              {sellerListings.map((item) => (
                <ListingTile
                  key={item.id}
                  href={listingDetailHref({
                    id: item.id,
                    slug: item.slug,
                    section: "used",
                    categories: item.categories as { slug?: string | null } | null,
                  })}
                  listingId={item.id}
                  title={capitalizeWords(item.title)}
                  imageAlt={capitalizeWords(item.title)}
                  listingImages={item.listing_images}
                  price={Number(item.price)}
                  linkLayout="unified"
                  useBlurPlaceholder={false}
                  cardClassName={listingProductCardGridClassName}
                  cardContentClassName="min-w-0 p-3"
                  favorites={{
                    initialFavorited: sellerListingFavIds.includes(item.id),
                    isLoggedIn: !!user,
                  }}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}
