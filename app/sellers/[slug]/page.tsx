import type { Metadata } from "next"
import Link from "next/link"
import Image from "next/image"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { wideShimmer } from "@/lib/image-shimmer"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { capitalizeWords, formatListingTileCategoryPillText } from "@/lib/listing-labels"
import { ListingTile } from "@/components/listing-tile"
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
} from "lucide-react"
import { VerifiedBadge } from "@/components/verified-badge"
import { listingProductCardGridClassName } from "@/lib/listing-card-styles"
import { FollowButton } from "@/components/follows/follow-button"
import { listingDetailHref } from "@/lib/listing-href"
import { computePeerCartPriceAction } from "@/lib/peer-listing-cart"
import { absoluteUrl } from "@/lib/site-metadata"

const PROFILE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const sellerProfileSelect =
  "id, seller_slug, display_name, avatar_url, location, city, bio, created_at, updated_at, is_shop, shop_name, shop_description, shop_banner_url, shop_logo_url, shop_verified, shop_website, shop_phone, shop_address, sales_count, follower_count"

function trimUrl(u: string | null | undefined): string | undefined {
  const t = typeof u === "string" ? u.trim() : ""
  return t.length > 0 ? t : undefined
}

/** Logo/avatar first (match profile card + user request); banner as wide fallback for OG. */
function sellerSocialImage(shop: {
  is_shop: boolean | null
  shop_logo_url: string | null
  avatar_url: string | null
  shop_banner_url: string | null
}): { url: string; isSquare: boolean } | undefined {
  if (shop.is_shop) {
    const logo = trimUrl(shop.shop_logo_url)
    if (logo) return { url: logo, isSquare: true }
  }
  const avatar = trimUrl(shop.avatar_url)
  if (avatar) return { url: avatar, isSquare: true }
  const banner = trimUrl(shop.shop_banner_url)
  if (banner) return { url: banner, isSquare: false }
  return undefined
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const supabase = await createClient()
  const byId = PROFILE_UUID_RE.test(slug)
  const metaSelect =
    "seller_slug, is_shop, shop_name, display_name, shop_description, bio, shop_logo_url, avatar_url, shop_banner_url, city, shop_address, shop_verified"

  const { data: shop } = byId
    ? await supabase.from("profiles").select(metaSelect).eq("id", slug).maybeSingle()
    : await supabase.from("profiles").select(metaSelect).eq("seller_slug", slug).maybeSingle()

  if (!shop) {
    return { title: "Seller — Reswell", description: "View this seller on Reswell." }
  }

  const displayName = shop.is_shop
    ? trimUrl(shop.shop_name) || trimUrl(shop.display_name) || "Seller"
    : trimUrl(shop.display_name) || "Seller"

  const title = `${displayName} · Reswell`

  const loc = trimUrl(shop.shop_address) || trimUrl(shop.city)
  const descPrimary =
    trimUrl(shop.shop_description) ||
    trimUrl(shop.bio) ||
    (loc
      ? `${displayName} on Reswell${shop.shop_verified ? " · Verified seller" : ""}. ${loc}.`
      : `${displayName} on Reswell${shop.shop_verified ? " · Verified seller" : ""}. Shop surf gear and boards.`)

  const description = descPrimary.slice(0, 180)

  const canonicalPath = `/sellers/${shop.seller_slug ?? slug}`
  const social = sellerSocialImage(shop)
  const twitterCard = social?.isSquare === false ? "summary_large_image" : social ? "summary" : "summary"

  return {
    title,
    description,
    alternates: { canonical: canonicalPath },
    openGraph: {
      title: displayName,
      description,
      type: "profile",
      url: absoluteUrl(canonicalPath),
      images: social
        ? [
            {
              url: social.url,
              alt: `${displayName} — profile`,
            },
          ]
        : undefined,
    },
    twitter: {
      card: twitterCard,
      title: displayName,
      description,
      images: social ? [social.url] : undefined,
    },
  }
}

export default async function SellerProfilePage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const supabase = await createClient()

  const byId = PROFILE_UUID_RE.test(slug)

  let shop: {
    id: string
    seller_slug: string
    display_name: string | null
    avatar_url: string | null
    location: string | null
    city: string | null
    bio: string | null
    created_at: string
    updated_at: string
    is_shop: boolean | null
    shop_name: string | null
    shop_description: string | null
    shop_banner_url: string | null
    shop_logo_url: string | null
    shop_verified: boolean | null
    shop_website: string | null
    shop_phone: string | null
    shop_address: string | null
    sales_count: number | null
    follower_count?: number | null
  } | null = null

  if (byId) {
    const { data } = await supabase
      .from("profiles")
      .select(sellerProfileSelect)
      .eq("id", slug)
      .maybeSingle()
    if (data?.seller_slug) {
      redirect(`/sellers/${data.seller_slug}`)
    }
    shop = data
  } else {
    const { data } = await supabase
      .from("profiles")
      .select(sellerProfileSelect)
      .eq("seller_slug", slug)
      .maybeSingle()
    shop = data
  }

  if (!shop) {
    notFound()
  }

  const id = shop.id

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: viewerProfile } = user
    ? await supabase.from("profiles").select("is_admin, is_employee").eq("id", user.id).maybeSingle()
    : { data: null }

  const canSeeHiddenListings =
    user?.id === id ||
    viewerProfile?.is_admin === true ||
    viewerProfile?.is_employee === true

  let listingsQuery = supabase
    .from("listings")
    .select(
      `
      *,
      listing_images (url, is_primary),
      categories (name, slug),
      inventory (quantity)
    `,
    )
    .eq("user_id", id)
  if (!canSeeHiddenListings) {
    listingsQuery = listingsQuery.eq("hidden_from_site", false)
  }
  const { data: listings } = await listingsQuery.order("created_at", { ascending: false })

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

  let favoritedIds: string[] = []
  if (user && listings && listings.length > 0) {
    const { data: favs } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .in("listing_id", listings.map((l: any) => l.id))
    favoritedIds = (favs ?? []).map((f) => f.listing_id)
  }

  // Follow status for the current user
  const isOwnProfile = user?.id === id
  let isFollowing = false
  const followerCount = (shop as { follower_count?: number }).follower_count ?? 0
  if (user && !isOwnProfile) {
    const { data: follow } = await supabase
      .from("seller_follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("seller_id", id)
      .maybeSingle()
    isFollowing = !!follow
  }

  const allListings = listings || []

  /** In-flight checkout (reserved) counts as current inventory, not "previous". */
  const inCurrentInventory = (l: (typeof allListings)[number]) =>
    !l.archived_at && (l.status === "active" || l.status === "pending_sale")

  const currentListings = allListings.filter(inCurrentInventory)

  /**
   * Public shop history: never show site-hidden (moderation) rows here, even for the seller.
   * User-ended / archived unsold listings use status `removed` (see endSellerListing archive).
   */
  const pastListings = allListings.filter((l) => {
    if (inCurrentInventory(l)) return false
    if (l.hidden_from_site) return false
    if (l.status === "removed" || l.status === "draft") return false
    return true
  })

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
      <main className="flex-1">
        {/* Banner */}
        <div className="relative h-40 sm:h-56 bg-offwhite overflow-hidden">
          {shop.shop_banner_url && (
            <Image
              src={shop.shop_banner_url}
              alt=""
              fill
              sizes="100vw"
              className="object-cover"
              placeholder="blur"
              blurDataURL={wideShimmer}
              priority
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
                    <Badge className="bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100">
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

                {/* Follow + contact row */}
                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <FollowButton
                    sellerId={shop.id}
                    sellerName={displayName}
                    sellerSlug={shop.seller_slug || undefined}
                    sellerCity={shop.city || undefined}
                    initialFollowing={isFollowing}
                    initialFollowerCount={followerCount}
                    isLoggedIn={!!user}
                    isOwnProfile={isOwnProfile}
                    showCount={true}
                  />

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
                <ListingGrid
                  listings={currentListings}
                  favoritedIds={favoritedIds}
                  isLoggedIn={!!user}
                  viewerId={user?.id ?? null}
                />
              </TabsContent>
              <TabsContent value="new" className="mt-6">
                <ListingGrid
                  listings={newListings}
                  favoritedIds={favoritedIds}
                  isLoggedIn={!!user}
                  viewerId={user?.id ?? null}
                />
              </TabsContent>
              <TabsContent value="boards" className="mt-6">
                <ListingGrid
                  listings={boardListings}
                  favoritedIds={favoritedIds}
                  isLoggedIn={!!user}
                  viewerId={user?.id ?? null}
                />
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
              <ListingGrid
                listings={pastListings}
                favoritedIds={favoritedIds}
                isLoggedIn={!!user}
                viewerId={user?.id ?? null}
              />
            </div>
          )}
        </div>
      </main>
  )
}

function ListingGrid({
  listings,
  favoritedIds,
  isLoggedIn,
  viewerId,
}: {
  listings: any[]
  favoritedIds: string[]
  isLoggedIn: boolean
  viewerId: string | null
}) {
  if (listings.length === 0) {
    return (
      <div className="text-center py-12">
        <Package className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-2 text-muted-foreground">No listings in this category</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {listings.map((listing) => {
        const href = listingDetailHref(listing)
        const loc =
          listing.city &&
          `${listing.city}${listing.state ? `, ${listing.state}` : ""}`
        const pill = formatListingTileCategoryPillText(listing)
        const statusLabel =
          !listing.status || listing.status === "active"
            ? null
            : listing.status === "sold"
              ? ("sold" as const)
              : listing.status === "pending"
                ? ("pending" as const)
                : ("ended" as const)
        const cartAction = computePeerCartPriceAction(viewerId, {
          id: listing.id,
          user_id: listing.user_id,
          section: listing.section,
          status: listing.status ?? "active",
          local_pickup: listing.local_pickup,
          shipping_available: listing.shipping_available,
        })
        return (
          <ListingTile
            key={listing.id}
            href={href}
            listingId={listing.id}
            title={capitalizeWords(listing.title)}
            imageAlt={capitalizeWords(listing.title)}
            listingImages={listing.listing_images}
            price={Number(listing.price)}
            linkLayout="split"
            useBlurPlaceholder={false}
            cardClassName={listingProductCardGridClassName}
            cardContentClassName="flex min-w-0 flex-1 flex-col p-3"
            statusLabel={statusLabel}
            meta={loc ? { variant: "location", text: loc, showMapPin: true } : null}
            metaRowClassName={loc ? "mt-2" : undefined}
            categoryPill={pill}
            priceAction={cartAction}
            favorites={{
              initialFavorited: favoritedIds.includes(listing.id),
              isLoggedIn,
            }}
          />
        )
      })}
    </div>
  )
}
