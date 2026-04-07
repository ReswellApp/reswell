import { notFound } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { portraitShimmer } from "@/lib/image-shimmer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { formatCondition, formatBoardType, capitalizeWords, getPublicSellerDisplayName } from "@/lib/listing-labels"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { createClient } from "@/lib/supabase/server"
import { ShareButton } from "@/components/share-button"
import { EndListingButton } from "@/components/end-listing-button"
import {
  ArrowLeft,
  MapPin,
  MessageSquare,
  Clock,
  Info,
} from "lucide-react"
import dynamic from "next/dynamic"
import { ListingPhotosPendingBanner } from "@/components/listing-photos-pending-banner"
import { ContactSellerForm } from "@/components/contact-seller-form"
import { FavoriteButton } from "@/components/favorite-button"
import {
  ListingSoldDetailNotice,
  ListingSoldOwnerNotice,
} from "@/components/listing-sold-detail-notice"

// Split Leaflet map into its own chunk. ssr:false is not allowed in Server Components
// (Next.js 16), but LocationMap is already SSR-safe — Leaflet only runs inside useEffect.
const LocationMap = dynamic(
  () => import("@/components/location-map").then((m) => ({ default: m.LocationMap })),
  { loading: () => <div className="h-[280px] rounded-lg bg-muted animate-pulse" /> },
)

// Gallery JS is deferred; the server renders the static first image wrapper
const ImageGallery = dynamic(
  () => import("@/components/image-gallery").then((m) => ({ default: m.ImageGallery })),
  {
    loading: () => (
      <div className="relative w-full rounded-lg overflow-hidden bg-muted" style={{ paddingBottom: "133.33%" }} />
    ),
  },
)
import { TranslateableDescription } from "@/components/translateable-description"
import { boardFulfillmentSummary } from "@/lib/listing-fulfillment"
import { findListingByParam } from "@/lib/listing-query"
import { VerifiedBadge } from "@/components/verified-badge"
import { ListingSellerStats } from "@/components/listing-seller-stats"
import { BRANDS_BASE } from "@/lib/brands/routes"
import { getBrandById } from "@/lib/brands/server"
import { listingProductCardClassName } from "@/lib/listing-card-styles"
import { cn } from "@/lib/utils"
import { sellerProfileHref } from "@/lib/seller-slug"
import { listingDetailHref } from "@/lib/listing-href"
import { ListingDetailPeerPurchaseActions } from "@/components/listing-detail-peer-purchase-actions"

export async function SurfboardListingDetailPage({
  listingParam,
}: {
  listingParam: string
}) {
  const supabase = await createClient()

  const { listing: board } = await findListingByParam(supabase, listingParam, {
    select: `
        *,
        listing_images (id, url, is_primary, sort_order),
        profiles (id, seller_slug, is_shop, shop_name, display_name, avatar_url, location, created_at, shop_verified, sales_count)
      `,
    section: "surfboards",
  })

  if (!board) {
    notFound()
  }

  // Ensure seller profile never contains private data (email, etc.) before sending to client
  const p = board.profiles as Record<string, unknown> | null
  if (p && typeof p === "object") {
    board.profiles = {
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
    .eq("reviewed_id", board.user_id)

  const reviewRatings = (sellerReviewRatings ?? []).map((r) => r.rating)
  const sellerReviewCount = reviewRatings.length
  const sellerAvgRating =
    sellerReviewCount > 0
      ? reviewRatings.reduce((sum, r) => sum + r, 0) / sellerReviewCount
      : 0

  // Get seller's other boards
  const { data: sellerBoards } = await supabase
    .from("listings")
    .select(`
      id,
      slug,
      title,
      price,
      board_length,
      listing_images (url, is_primary)
    `)
    .eq("user_id", board.user_id)
    .eq("status", "active")
    .eq("section", "surfboards")
    .neq("id", board.id)
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
      .eq("listing_id", board.id)
      .single()
    isFavorited = !!favorite
  }

  const images = board.listing_images?.sort((a: { is_primary: boolean; sort_order?: number }, b: { is_primary: boolean; sort_order?: number }) => 
    (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0) || (a.sort_order ?? 0) - (b.sort_order ?? 0)
  ) || []

  const isOwnListing = user?.id === board.user_id
  const isSold = board.status === "sold"

  const pickupOffered = board.local_pickup !== false
  const shippingOffered = !!board.shipping_available

  const canPeerPurchase =
    !isOwnListing &&
    !isSold &&
    (board.status === "active" || board.status === "pending_sale") &&
    (pickupOffered || shippingOffered)

  const boardPickupCity = board.profiles?.location
    ? (board.profiles.location as string).split(",")[0]?.trim()
    : null

  const brandId = (board as { brand_id?: string | null }).brand_id?.trim() ?? ""
  const indexBrand = brandId ? await getBrandById(supabase, brandId) : null

  return (
      <main className="flex-1 py-8">
        <div className="container mx-auto">
          {/* Breadcrumb */}
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-6">
            <Link href="/boards" className="hover:text-foreground flex items-center gap-1">
              <ArrowLeft className="h-4 w-4" />
              Back to Surfboards
            </Link>
            {board.board_type && (
              <>
                <span>/</span>
                <Link
                  href={`/boards?type=${board.board_type}`}
                  className="hover:text-foreground capitalize"
                >
                  {board.board_type}
                </Link>
              </>
            )}
          </div>

          {isSold && (
            <div className="max-w-5xl mx-auto mb-6">
              <ListingSoldDetailNotice />
            </div>
          )}

          {/* Mobile heading + actions above images */}
          <div className="mb-2 lg:hidden flex items-start justify-between gap-3">
            <h1 className="text-xl font-bold break-words flex-1">
              {capitalizeWords(board.title)}
            </h1>
            <div className="flex items-center gap-2 shrink-0">
              <FavoriteButton
                listingId={board.id}
                initialFavorited={isFavorited}
                isLoggedIn={!!user}
              />
              <ShareButton title={capitalizeWords(board.title)} />
            </div>
          </div>

          {/* Mobile price + tags above images */}
          <div className="mb-4 lg:hidden">
            {isSold ? (
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
                Sold for ${board.price.toFixed(2)}
              </p>
            ) : (
              <p className="text-2xl font-bold text-black dark:text-white">
                ${board.price.toFixed(2)}
              </p>
            )}
            <p className="mt-1 text-sm text-muted-foreground">
              {[
                formatCondition(board.condition),
                board.board_type ? formatBoardType(board.board_type) : null,
                board.board_length || null,
                boardFulfillmentSummary(board.local_pickup, board.shipping_available),
              ].filter(Boolean).join(" · ")}
            </p>
            {canPeerPurchase && (
              <div className="mt-4">
                <ListingDetailPeerPurchaseActions
                  listingId={board.id}
                  checkoutListingParam={board.slug ?? board.id}
                  section="surfboards"
                  isLoggedIn={!!user}
                />
              </div>
            )}
          </div>

          <div className="grid lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
            {/* Images */}
            <div>
              {!(isSold && isOwnListing) && (
                <ListingPhotosPendingBanner imageCount={images.length} isOwner={isOwnListing} />
              )}
              <ImageGallery images={images} title={capitalizeWords(board.title)} sold={isSold} />
            </div>

            {/* Details */}
            <div className="space-y-4 min-w-0">
              <div>
                <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
                  <h1 className="hidden lg:block text-xl font-bold sm:text-2xl break-words">
                    {capitalizeWords(board.title)}
                  </h1>
                  <div className="hidden lg:flex items-center gap-2 shrink-0">
                    <FavoriteButton
                      listingId={board.id}
                      initialFavorited={isFavorited}
                      isLoggedIn={!!user}
                    />
                    <ShareButton title={capitalizeWords(board.title)} />
                  </div>
                </div>
                {isSold ? (
                  <p className="hidden lg:block text-2xl sm:text-3xl font-bold text-emerald-600 dark:text-emerald-400 mt-2">
                    Sold for ${board.price.toFixed(2)}
                  </p>
                ) : (
                  <p className="hidden lg:block text-2xl sm:text-3xl font-bold text-black dark:text-white mt-2">
                    ${board.price.toFixed(2)}
                  </p>
                )}
                {canPeerPurchase && (
                  <div className="mt-4 hidden lg:block">
                    <ListingDetailPeerPurchaseActions
                      listingId={board.id}
                      checkoutListingParam={board.slug ?? board.id}
                      section="surfboards"
                      isLoggedIn={!!user}
                    />
                  </div>
                )}
              </div>

              <p className="hidden lg:block text-sm text-muted-foreground">
                {[
                  formatCondition(board.condition),
                  board.board_type ? formatBoardType(board.board_type) : null,
                  board.board_length || null,
                  boardFulfillmentSummary(board.local_pickup, board.shipping_available),
                ].filter(Boolean).join(" · ")}
              </p>

              {/* Description (above map) */}
              <div>
                <h2 className="font-semibold mb-2">Description</h2>
                <TranslateableDescription text={board.description || ""} />
              </div>

              {indexBrand ? (
                <div className="rounded-lg border border-border/50 bg-muted/20 px-4 py-3 text-sm">
                  <p className="text-muted-foreground mb-1">Brand</p>
                  <Link
                    href={`${BRANDS_BASE}/${indexBrand.slug}`}
                    className="font-medium text-primary underline-offset-4 hover:underline"
                  >
                    View {indexBrand.name} on Brands
                  </Link>
                </div>
              ) : null}

              {/* Seller (above map) */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex flex-col gap-4">
                    <Link
                      href={sellerProfileHref(board.profiles)}
                      className="flex items-center gap-4"
                    >
                      <Avatar className="h-12 w-12 shrink-0">
                        <AvatarImage src={board.profiles?.avatar_url || ""} />
                        <AvatarFallback>
                          {getPublicSellerDisplayName(board.profiles).charAt(0).toUpperCase() || "U"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium flex items-center gap-1">
                          {getPublicSellerDisplayName(board.profiles)}
                          {board.profiles?.shop_verified && <VerifiedBadge size="sm" />}
                        </p>
                        {board.profiles?.location && (
                          <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                            <MapPin className="h-3 w-3 shrink-0" />
                            {board.profiles.location}
                          </p>
                        )}
                        <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1">
                          <Clock className="h-3 w-3 shrink-0" />
                          Member since{" "}
                          {new Date(board.profiles?.created_at).toLocaleDateString("en-US", {
                            month: "long",
                            year: "numeric",
                          })}
                        </p>
                        <ListingSellerStats
                          avgRating={sellerAvgRating}
                          reviewCount={sellerReviewCount}
                          itemsSold={Number(board.profiles?.sales_count ?? 0)}
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
                                ? `/messages?user=${board.user_id}&listing=${board.id}`
                                : `/auth/login?redirect=${encodeURIComponent(listingDetailHref(board))}`
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
                          <Link href={sellerProfileHref(board.profiles)}>
                            View Profile
                          </Link>
                        </Button>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Location (map) */}
              <Card className="bg-primary/5 border-primary/20 overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center gap-2 text-primary">
                    <MapPin className="h-5 w-5" />
                    <span className="font-medium">
                      {board.city && board.state
                        ? `${board.city}, ${board.state}`
                        : board.profiles?.location || "Location not specified"}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1 mb-3">
                    {pickupOffered && shippingOffered &&
                      "Approximate area for pickup, or the seller can ship this board to you."}
                    {pickupOffered && !shippingOffered &&
                      "Approximate pickup area for meeting the seller and inspecting the board."}
                    {!pickupOffered &&
                      shippingOffered &&
                      "Seller ships this board. Use checkout to pay, then confirm your shipping address in messages."}
                  </p>
                  {pickupOffered && board.latitude && board.longitude ? (
                    <LocationMap
                      lat={parseFloat(board.latitude)}
                      lng={parseFloat(board.longitude)}
                      label={
                        board.city && board.state
                          ? `${board.city}, ${board.state}`
                          : "Pickup Location"
                      }
                      showDirections
                      height={280}
                    />
                  ) : pickupOffered && board.profiles?.location ? (
                    <div className="h-[200px] rounded-lg bg-muted flex items-center justify-center text-muted-foreground text-sm">
                      <MapPin className="h-5 w-5 mr-2" />
                      {board.profiles.location}
                    </div>
                  ) : !pickupOffered ? (
                    <p className="text-sm text-muted-foreground py-4">
                      Map is shown when the seller offers local pickup.
                    </p>
                  ) : null}
                </CardContent>
              </Card>

              {/* Contact Form */}
              {!isOwnListing && !isSold && (
                <Card className="bg-offwhite">
                  <CardContent className="p-4">
                    <ContactSellerForm
                      listingId={board.id}
                      listingSlug={board.slug}
                      sellerId={board.user_id}
                      listingTitle={capitalizeWords(board.title)}
                      isLoggedIn={!!user}
                      section="surfboards"
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
                      sectionLabel="board"
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
                        <Link href={`/dashboard/listings/${board.id}/edit`}>
                          Edit listing
                        </Link>
                      </Button>
                      <EndListingButton listingId={board.id} />
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Safety Tips */}
              <div className="bg-muted/50 rounded-lg p-4">
                <div className="flex items-center gap-2 text-sm font-medium mb-2">
                  <Info className="h-4 w-4 text-primary" />
                  Tips for Board Pickups
                </div>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>Meet in a public place like a beach parking lot</li>
                  <li>Bring a friend if possible</li>
                  <li>Check for cracks, dings, and delamination</li>
                  <li>Test the flex and check fin boxes</li>
                  <li>Always complete payment through the platform — off-platform transactions are not covered by Purchase Protection</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Seller's Other Boards */}
          {sellerBoards && sellerBoards.length > 0 && (
            <section className="mt-16">
              <h2 className="text-xl font-bold mb-6">More Boards from this Seller</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {sellerBoards.map((item) => {
                  const primaryImage = item.listing_images?.find((img: { is_primary: boolean }) => img.is_primary) || item.listing_images?.[0]
                  return (
                    <Link
                      key={item.id}
                      href={listingDetailHref({
                        id: item.id,
                        slug: item.slug,
                        section: "surfboards",
                      })}
                      className="min-w-0 block"
                    >
                      <Card className={cn(listingProductCardClassName, "min-w-0")}>
                        <div className="aspect-[3/4] w-full relative bg-muted">
                          {primaryImage?.url ? (
                            <Image
                              src={primaryImage.url || "/placeholder.svg"}
                              alt={item.title}
                              fill
                              className="object-contain group-hover:scale-105 transition-transform duration-300"
                              placeholder="blur"
                              blurDataURL={portraitShimmer}
                            />
                          ) : (
                            <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                              No Image
                            </div>
                          )}
                        </div>
                        <CardContent className="min-w-0 p-3">
                          <h3 className="text-sm font-medium line-clamp-2 min-h-[2.8em]">{item.title}</h3>
                          {item.board_length && (
                            <p className="text-sm text-muted-foreground">{item.board_length}</p>
                          )}
                          <p className="text-base font-bold text-black dark:text-white mt-1">
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
  )
}
