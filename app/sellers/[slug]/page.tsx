import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { resolveDynamicSeo } from "@/lib/seo/resolve-dynamic-seo"
import { SellerProfileView } from "@/components/sellers/seller-profile-view"
import type { SellerProfileListing } from "@/components/sellers/seller-profile-listings-panel"
import { deriveSellerDirectoryTileMeta } from "@/lib/sellers/directory-tile-meta"
import { absoluteProxiedProfileMediaUrl } from "@/lib/public-media-display-src"
import { absoluteUrl } from "@/lib/site-metadata"
import { PEER_LISTING_SECTIONS_FILTER } from "@/lib/peer-listing-sections"
import { configuredReswellShopOwnerUserId } from "@/lib/services/resolveReswellShopOwnerUser"

const PROFILE_UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const sellerProfileSelect =
  "id, seller_slug, display_name, avatar_url, avatar_focal_x_pct, avatar_focal_y_pct, location, city, bio, created_at, updated_at, last_active_at, is_shop, shop_name, shop_description, shop_banner_url, shop_banner_focal_x_pct, shop_banner_focal_y_pct, shop_logo_url, shop_verified, shop_website, shop_phone, shop_address, sales_count, follower_count"

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
    const logo = absoluteProxiedProfileMediaUrl(shop.shop_logo_url)
    if (logo) return { url: logo, isSquare: true }
  }
  const avatar = absoluteProxiedProfileMediaUrl(shop.avatar_url)
  if (avatar) return { url: avatar, isSquare: true }
  const banner = absoluteProxiedProfileMediaUrl(shop.shop_banner_url)
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
    last_active_at: string | null
    is_shop: boolean | null
    shop_name: string | null
    shop_description: string | null
    shop_banner_url: string | null
    shop_banner_focal_x_pct: number | null
    shop_banner_focal_y_pct: number | null
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

  // Platform retail owner has no public seller storefront — send traffic to /reswell/shop.
  if (configuredReswellShopOwnerUserId() === id) {
    redirect("/reswell/shop")
  }

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
    .in("section", PEER_LISTING_SECTIONS_FILTER)
  if (!canSeeHiddenListings) {
    // Sold history stays public on the profile even after seller archive/cleanup.
    listingsQuery = listingsQuery.or("hidden_from_site.eq.false,status.eq.sold")
  }
  const { data: listings } = await listingsQuery.order("created_at", { ascending: false })

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
  const reviewsAsSeller = allReviews.filter((r) => pickRel(r.listing)?.user_id === id)
  const reviewsAsBuyer = allReviews.filter((r) => pickRel(r.listing)?.user_id !== id)

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
      .in("listing_id", listings.map((l) => l.id))
    favoritedIds = (favs ?? []).map((f) => f.listing_id)
  }

  const isOwnProfile = user?.id === id
  let isFollowing = false
  const followerCount = shop.follower_count ?? 0
  if (user && !isOwnProfile) {
    const { data: follow } = await supabase
      .from("seller_follows")
      .select("id")
      .eq("follower_id", user.id)
      .eq("seller_id", id)
      .maybeSingle()
    isFollowing = !!follow
  }

  let followingCount: number | null = null
  if (isOwnProfile) {
    const { count } = await supabase
      .from("seller_follows")
      .select("id", { count: "exact", head: true })
      .eq("follower_id", id)
    followingCount = count ?? 0
  }

  const allListings = listings || []

  // Exclude vacation / site-hidden from shop inventory (owners still see them in My Listings).
  const inCurrentInventory = (l: (typeof allListings)[number]) =>
    !l.archived_at &&
    !l.hidden_from_site &&
    (l.status === "active" || l.status === "pending_sale")

  const currentListings = allListings.filter(inCurrentInventory)

  const pastListings = allListings.filter((l) => {
    if (inCurrentInventory(l)) return false
    if (l.status === "removed" || l.status === "draft") return false
    if (l.status === "sold") return true
    if (l.hidden_from_site) return false
    return true
  })

  const tileMeta = deriveSellerDirectoryTileMeta(
    allListings.map((listing) => ({
      city: listing.city ?? null,
      state: listing.state ?? null,
      shipping_available: listing.shipping_available ?? null,
    })),
  )

  const isShop = shop.is_shop
  const displayName = isShop ? shop.shop_name || shop.display_name : shop.display_name
  const soldCount = shop.sales_count ?? 0

  function mapListing(listing: (typeof allListings)[number]): SellerProfileListing {
    return {
      id: listing.id,
      slug: listing.slug,
      user_id: listing.user_id,
      title: listing.title,
      price: listing.price,
      compare_at_price: (listing as { compare_at_price?: number | string | null }).compare_at_price ?? null,
      status: listing.status ?? "active",
      section: listing.section,
      local_pickup: listing.local_pickup,
      shipping_available: listing.shipping_available,
      condition: listing.condition,
      created_at: listing.created_at,
      listing_images: listing.listing_images,
      categories: listing.categories,
      board_type: listing.board_type,
    }
  }

  function mapReview(
    review: ReviewRow,
    defaultReviewerLabel: string,
  ) {
    const reviewer = pickRel(review.reviewer)
    return {
      id: review.id,
      rating: review.rating,
      comment: review.comment,
      created_at: review.created_at,
      reviewerLabel: reviewer?.display_name?.trim() || defaultReviewerLabel,
    }
  }

  return (
    <SellerProfileView
      shop={shop}
      displayName={displayName}
      isShop={isShop}
      avgRating={avgRating}
      reviewCount={reviewCount}
      currentListingCount={currentListings.length}
      followerCount={followerCount}
      followingCount={followingCount}
      soldCount={soldCount}
      isFollowing={isFollowing}
      isOwnProfile={isOwnProfile}
      isLoggedIn={!!user}
      currentListings={currentListings.map(mapListing)}
      pastListings={pastListings.map(mapListing)}
      favoritedIds={favoritedIds}
      viewerId={user?.id ?? null}
      tileMeta={tileMeta}
      reviewsAsSeller={reviewsAsSeller.map((review) => mapReview(review, "Verified buyer"))}
      reviewsAsBuyer={reviewsAsBuyer.map((review) => mapReview(review, "Verified seller"))}
    />
  )
}
