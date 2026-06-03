import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { Card, CardContent } from "@/components/ui/card"
import { resolveDynamicSeo } from "@/lib/seo/resolve-dynamic-seo"
import { HomePeerListingScrollTile } from "@/components/features/home/home-peer-listing-scroll-tile"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Star, Package } from "lucide-react"
import { SellerRatingStarRow } from "@/components/seller-rating-stars"
import { SellerProfileHero } from "@/components/sellers/seller-profile-hero"
import { FadeInSection } from "@/components/fade-in-section"
import { ratingStarFilledClassName } from "@/lib/rating-star-styles"
import { cn } from "@/lib/utils"
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

  const loc = trimUrl(shop.shop_address) || trimUrl(shop.city)
  const fallbackTitle = `${displayName} · Reswell`
  const descPrimary =
    trimUrl(shop.shop_description) ||
    trimUrl(shop.bio) ||
    (loc
      ? `${displayName} on Reswell${shop.shop_verified ? " · Verified seller" : ""}. ${loc}.`
      : `${displayName} on Reswell${shop.shop_verified ? " · Verified seller" : ""}. Shop surf gear and boards.`)

  const seo = await resolveDynamicSeo(
    "type:seller",
    { name: displayName, location: loc || undefined },
    { title: fallbackTitle, description: descPrimary.slice(0, 180) },
  )
  const title = seo.title
  const description = seo.description

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
      categories (name, slug)
    `,
    )
    .eq("user_id", id)
  if (!canSeeHiddenListings) {
    listingsQuery = listingsQuery.eq("hidden_from_site", false)
  }
  const { data: listings } = await listingsQuery.order("created_at", { ascending: false })

  /**
   * Fetch reviews received in either direction (buyer→seller and seller→buyer).
   * The listing owner determines direction: if `listing.user_id === id`, the
   * reviewed user was the seller (reviews "as seller"); otherwise they were
   * the buyer (reviews "as buyer"). Both sections render on this page so a
   * visitor sees the user's full reputation across roles.
   */
  const { data: reviews } = await supabase
    .from("reviews")
    .select(
      "id, rating, comment, created_at, reviewer:profiles!reviews_reviewer_id_fkey ( display_name ), listing:listings!reviews_listing_id_fkey ( user_id )",
    )
    .eq("reviewed_id", id)
    .order("created_at", { ascending: false })

  type ReviewRow = {
    id: string
    rating: number
    comment: string | null
    created_at: string
    reviewer:
      | { display_name: string | null }
      | { display_name: string | null }[]
      | null
    listing:
      | { user_id: string | null }
      | { user_id: string | null }[]
      | null
  }

  function pickRel<T>(rel: T | T[] | null | undefined): T | null {
    if (rel == null) return null
    return Array.isArray(rel) ? rel[0] ?? null : rel
  }

  const allReviews = (reviews ?? []) as ReviewRow[]
  const reviewsAsSeller = allReviews.filter(
    (r) => pickRel(r.listing)?.user_id === id,
  )
  const reviewsAsBuyer = allReviews.filter(
    (r) => pickRel(r.listing)?.user_id !== id,
  )

  const avgRating =
    allReviews.length > 0
      ? allReviews.reduce((sum, r) => sum + r.rating, 0) / allReviews.length
      : 0
  const reviewCount = allReviews.length

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
        <SellerProfileHero
          shop={shop}
          displayName={displayName}
          isShop={isShop}
          avgRating={avgRating}
          reviewCount={reviewCount}
          currentListingCount={currentListings.length}
          followerCount={followerCount}
          isFollowing={isFollowing}
          isOwnProfile={isOwnProfile}
          isLoggedIn={!!user}
        />

        <div className="container mx-auto max-w-6xl px-4 sm:px-6">
          <FadeInSection>
          <ReviewsSection
            heading="Reviews as a seller"
            emptyFallback={
              reviewCount === 0
                ? "No reviews yet."
                : "No seller reviews yet."
            }
            defaultReviewerLabel="Verified buyer"
            reviews={reviewsAsSeller}
          />
          {reviewsAsBuyer.length > 0 ? (
            <ReviewsSection
              heading="Reviews as a buyer"
              emptyFallback="No buyer reviews yet."
              defaultReviewerLabel="Verified seller"
              reviews={reviewsAsBuyer}
            />
          ) : null}
          </FadeInSection>

          <FadeInSection delay={80}>
          <div className="border-t border-border/80 py-10 sm:py-12">
            <div className="mb-6">
              <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                Shop their listings
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {currentListings.length} active now
                {totalListings !== currentListings.length
                  ? ` · ${totalListings} total on profile`
                  : null}
              </p>
            </div>
            <Tabs defaultValue="all">
              <TabsList className="h-auto flex-wrap gap-1 bg-muted/40 p-1">
                <TabsTrigger value="all" className="rounded-full px-4">
                  All ({currentListings.length})
                </TabsTrigger>
                {newListings.length > 0 && (
                  <TabsTrigger value="new" className="rounded-full px-4">
                    New ({newListings.length})
                  </TabsTrigger>
                )}
                {boardListings.length > 0 && (
                  <TabsTrigger value="boards" className="rounded-full px-4">
                    Boards ({boardListings.length})
                  </TabsTrigger>
                )}
              </TabsList>

              <TabsContent value="all" className="mt-6">
                <ListingGrid
                  listings={currentListings}
                  favoritedIds={favoritedIds}
                  viewerId={user?.id ?? null}
                />
              </TabsContent>
              <TabsContent value="new" className="mt-6">
                <ListingGrid
                  listings={newListings}
                  favoritedIds={favoritedIds}
                  viewerId={user?.id ?? null}
                />
              </TabsContent>
              <TabsContent value="boards" className="mt-6">
                <ListingGrid
                  listings={boardListings}
                  favoritedIds={favoritedIds}
                  viewerId={user?.id ?? null}
                />
              </TabsContent>
            </Tabs>
          </div>
          </FadeInSection>

          {pastListings.length > 0 && (
            <FadeInSection delay={120}>
            <div className="border-t border-border/80 py-10 sm:py-12">
              <h2 className="mb-6 flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                <Package className="h-5 w-5 text-muted-foreground" aria-hidden />
                Previous &amp; sold
                <span className="text-sm font-normal text-muted-foreground">
                  ({pastListings.length})
                </span>
              </h2>
              <ListingGrid
                listings={pastListings}
                favoritedIds={favoritedIds}
                viewerId={user?.id ?? null}
              />
            </div>
            </FadeInSection>
          )}
        </div>
      </main>
  )
}

function ReviewsSection({
  heading,
  emptyFallback,
  defaultReviewerLabel,
  reviews,
}: {
  heading: string
  emptyFallback: string
  defaultReviewerLabel: string
  reviews: Array<{
    id: string
    rating: number
    comment: string | null
    created_at: string
    reviewer:
      | { display_name: string | null }
      | { display_name: string | null }[]
      | null
  }>
}) {
  return (
    <div className="py-8 sm:py-10">
      <h2 className="mb-5 flex items-center gap-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        <Star className={cn("h-5 w-5", ratingStarFilledClassName)} strokeWidth={0} aria-hidden />
        {heading}
      </h2>
      {reviews.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2">
          {reviews.map((review) => {
            const rel = review.reviewer
            const reviewer = Array.isArray(rel) ? rel[0] : rel
            const reviewerLabel =
              reviewer?.display_name?.trim() || defaultReviewerLabel
            return (
              <Card key={review.id} className="border-border/80 shadow-soft">
                <CardContent className="px-4 py-4">
                  <div className="flex items-center gap-2 text-sm mb-1 flex-wrap">
                    <span className="font-medium text-foreground">{reviewerLabel}</span>
                    <span className="text-muted-foreground">·</span>
                    <span
                      className="inline-flex items-center"
                      role="img"
                      aria-label={`${review.rating} out of 5 stars`}
                    >
                      <SellerRatingStarRow value={review.rating} size="md" />
                    </span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {review.created_at
                        ? new Date(review.created_at).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                          })
                        : null}
                    </span>
                  </div>
                  {review.comment?.trim() ? (
                    <p className="text-sm text-muted-foreground">{review.comment}</p>
                  ) : null}
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyFallback}</p>
      )}
    </div>
  )
}

function ListingGrid({
  listings,
  favoritedIds,
  viewerId,
}: {
  listings: any[]
  favoritedIds: string[]
  viewerId: string | null
}) {
  if (listings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 py-14 text-center">
        <Package className="mx-auto h-10 w-10 text-muted-foreground" aria-hidden />
        <p className="mt-3 text-muted-foreground">No listings in this category yet.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
      {listings.map((listing) => {
        const statusLabel =
          !listing.status || listing.status === "active"
            ? null
            : listing.status === "sold"
              ? ("sold" as const)
              : listing.status === "pending"
                ? ("pending" as const)
                : ("ended" as const)
        return (
          <HomePeerListingScrollTile
            key={listing.id}
            layout="grid"
            userId={viewerId}
            isFavorited={favoritedIds.includes(listing.id)}
            statusLabel={statusLabel}
            listing={{
              id: listing.id,
              slug: listing.slug,
              user_id: listing.user_id,
              title: listing.title,
              price: listing.price,
              status: listing.status ?? "active",
              section: listing.section,
              local_pickup: listing.local_pickup,
              shipping_available: listing.shipping_available,
              listing_images: listing.listing_images,
              categories: listing.categories,
              board_type: listing.board_type,
              condition: listing.condition,
            }}
          />
        )
      })}
    </div>
  )
}
