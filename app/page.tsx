import Link from "next/link"
import Image from "next/image"
import { wideShimmer } from "@/lib/image-shimmer"
import { FALLBACK_HOME_HERO_SLIDE_PATHS, HeroSlideshow } from "@/components/hero-slideshow"
import { HomeHeroSlideshowAdminBar } from "@/components/home-hero-slideshow-admin-bar"
import { buildHomeHeroSlideUrls } from "@/lib/home-hero-slide-urls"
import { getCachedHomeHeroImageUrls } from "@/lib/home-hero-slideshow-cache"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  ArrowRight,
  MapPin,
  Shield,
  MessageSquare,
  Recycle,
  Users,
  Store,
} from "lucide-react"
import { VerifiedBadge } from "@/components/verified-badge"
import { listingProductCardClassName } from "@/lib/listing-card-styles"
import { cn } from "@/lib/utils"
import { sellerProfileHref } from "@/lib/seller-slug"
import { boardsBrowseLinkPrefetch } from "@/lib/boards-link-prefetch"
import { FadeInSection } from "@/components/fade-in-section"
import { surfboardBrowseLinks } from "@/lib/site-category-directory"
import { HomeListingScrollRow, HomePeerListingScrollTile } from "@/components/features/home"
import { ShopNewListingStandardTile } from "@/components/features/marketplace/shop-new-listing-standard-tile"

function boardBrowseSlugFromHref(href: string): string | null {
  const q = href.split("?")[1]
  if (!q) return null
  const type = new URLSearchParams(q).get("type")
  return type?.trim() ? type : null
}

const categories = surfboardBrowseLinks.map((c) => ({
  name: c.label,
  href: c.href,
  slug: boardBrowseSlugFromHref(c.href),
}))

const features = [
  {
    icon: Recycle,
    title: "Sustainable Surfing",
    description: "Give your gear a second life and reduce waste in the surfing community.",
  },
  {
    icon: Shield,
    title: "Secure Transactions",
    description: "Protected payments and verified sellers for peace of mind.",
  },
  {
    icon: MessageSquare,
    title: "Direct Communication",
    description: "Chat directly with buyers and sellers to ask questions and negotiate.",
  },
  {
    icon: MapPin,
    title: "Local Pickup",
    description: "Find surfboards near you for in-person inspection and pickup.",
  },
]

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const supabase = await createClient()

  const homeHeroExtraUrls = await getCachedHomeHeroImageUrls()
  const heroSlideUrls = buildHomeHeroSlideUrls(homeHeroExtraUrls, FALLBACK_HOME_HERO_SLIDE_PATHS)

  // Fetch featured shops - public profile fields only; never expose email or role flags
  const profilePublicFields =
    "id, seller_slug, display_name, avatar_url, location, city, bio, created_at, updated_at, is_shop, shop_name, shop_description, shop_banner_url, shop_logo_url, shop_verified, shop_website, shop_phone, shop_address, sales_count"
  const { data: featuredShops } = await supabase
    .from("profiles")
    .select(profilePublicFields)
    .eq("is_shop", true)
    .order("sales_count", { ascending: false })
    .order("shop_verified", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(4)

  // Fetch featured boards (in-person only) - prioritize top sellers
  const { data: rawFeaturedBoards } = await supabase
    .from("listings")
    .select(`
      *,
      listing_images (url, thumbnail_url, sort_order, is_primary),
      profiles (display_name, avatar_url, location, sales_count, shop_verified),
      categories (name)
    `)
    .eq("status", "active")
    .eq("section", "surfboards")
    .eq("hidden_from_site", false)
    .order("created_at", { ascending: false })
    .limit(20)

  const featuredBoards = rawFeaturedBoards
    ? [...rawFeaturedBoards]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20)
    : null

  const { data: rawFeaturedShortboards } = await supabase
    .from("listings")
    .select(`
      *,
      listing_images (url, thumbnail_url, sort_order, is_primary),
      profiles (display_name, avatar_url, location, sales_count, shop_verified),
      categories (name)
    `)
    .eq("status", "active")
    .eq("section", "surfboards")
    .eq("board_type", "shortboard")
    .eq("hidden_from_site", false)
    .order("created_at", { ascending: false })
    .limit(20)

  const featuredShortboards = rawFeaturedShortboards
    ? [...rawFeaturedShortboards]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20)
    : null

  // Recently verified sellers: each card shows their single most expensive active listing + profile
  const verifiedForSpotlightFields =
    "id, seller_slug, display_name, avatar_url, city, is_shop, shop_name, shop_logo_url, shop_verified, shop_verified_at, updated_at"
  const { data: recentVerifiedProfiles } = await supabase
    .from("profiles")
    .select(verifiedForSpotlightFields)
    .eq("shop_verified", true)
    .order("shop_verified_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false })
    .limit(48)

  const verifiedProfileIds = (recentVerifiedProfiles ?? []).map((p) => p.id)
  type ListingRow = NonNullable<typeof rawFeaturedBoards>[number]
  let verifiedSpotlight: { profile: NonNullable<typeof recentVerifiedProfiles>[number]; listing: ListingRow }[] = []

  if (verifiedProfileIds.length > 0) {
    const { data: listingsForVerified } = await supabase
      .from("listings")
      .select(
        `
        *,
        listing_images (url, thumbnail_url, sort_order, is_primary),
        profiles (display_name, avatar_url, sales_count, shop_verified),
        categories (name)
      `
      )
      .in("user_id", verifiedProfileIds)
      .eq("status", "active")
      .eq("section", "surfboards")
      .eq("hidden_from_site", false)

    const bestByUser = new Map<string, ListingRow>()
    for (const listing of (listingsForVerified ?? []) as ListingRow[]) {
      const uid = listing.user_id
      const prev = bestByUser.get(uid)
      const price = Number(listing.price)
      if (!prev || price > Number(prev.price)) {
        bestByUser.set(uid, listing)
      }
    }

    for (const profile of recentVerifiedProfiles ?? []) {
      const listing = bestByUser.get(profile.id)
      if (listing) {
        verifiedSpotlight.push({ profile, listing })
        if (verifiedSpotlight.length >= 20) break
      }
    }
  }

  // Browse by Category: same real listings as “Recently added surfboards” — resolve by `board_type` = `/boards?type=` param.
  const { data: listingsForBrowseByCategory } = await supabase
    .from("listings")
    .select(
      `
      *,
      listing_images (url, thumbnail_url, sort_order, is_primary),
      profiles (display_name, avatar_url, location, sales_count, shop_verified),
      categories (name)
    `,
    )
    .eq("status", "active")
    .eq("section", "surfboards")
    .eq("hidden_from_site", false)
    .order("created_at", { ascending: false })
    .limit(400)

  type BrowseListingRow = NonNullable<typeof listingsForBrowseByCategory>[number]
  const sortedForBrowse =
    listingsForBrowseByCategory != null
      ? [...listingsForBrowseByCategory].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        )
      : []

  const latestByBoardType = new Map<string, BrowseListingRow>()
  for (const row of sortedForBrowse) {
    const bt = typeof row.board_type === "string" ? row.board_type.trim() : ""
    if (bt && !latestByBoardType.has(bt)) {
      latestByBoardType.set(bt, row)
    }
  }

  const browseCategoryTiles: { category: (typeof categories)[number]; listing: BrowseListingRow }[] = []
  for (const cat of categories) {
    const listing =
      cat.slug === null ? sortedForBrowse[0] : latestByBoardType.get(cat.slug)
    if (listing) {
      browseCategoryTiles.push({ category: cat, listing })
    }
  }

  const { data: rawFeaturedNew } = await supabase
    .from("listings")
    .select(
      `
      id,
      slug,
      title,
      price,
      listing_images (url, thumbnail_url, sort_order, is_primary),
      inventory (quantity),
      categories (name)
    `,
    )
    .eq("section", "new")
    .eq("status", "active")
    .eq("hidden_from_site", false)
    .order("created_at", { ascending: false })
    .limit(12)

  const featuredNew =
    rawFeaturedNew
      ?.map((l) => {
        const inv = Array.isArray(l.inventory) ? l.inventory[0] : l.inventory
        const qty = inv ? Number((inv as { quantity: number }).quantity) : 0
        const cat = l.categories as { name?: string | null } | { name?: string | null }[] | null | undefined
        const catRow = Array.isArray(cat) ? cat[0] : cat
        return { listing: l, stockQuantity: qty, categoryName: catRow?.name ?? null }
      })
      .filter((x) => x.stockQuantity > 0)
      .slice(0, 4) ?? []

  const { data: { user } } = await supabase.auth.getUser()
  const featuredListingIds = [
    ...(featuredBoards ?? []).map((b) => b.id),
    ...(featuredShortboards ?? []).map((b) => b.id),
    ...verifiedSpotlight.map(({ listing }) => listing.id),
    ...browseCategoryTiles.map(({ listing }) => listing.id),
    ...featuredNew.map(({ listing }) => listing.id),
  ]
  let favoritedIds: string[] = []
  if (user && featuredListingIds.length > 0) {
    const { data: favs } = await supabase
      .from("favorites")
      .select("listing_id")
      .eq("user_id", user.id)
      .in("listing_id", featuredListingIds)
    favoritedIds = (favs ?? []).map((f) => f.listing_id)
  }

  return (
      <main className="flex-1">
        {/* CLS-FIX: hero has explicit min-height so the section never reflows
            while the slideshow images decode or fonts swap in. */}
        <section className="relative min-h-[420px] sm:min-h-[480px] md:min-h-[540px] flex items-center overflow-hidden">
          <HeroSlideshow
            key={heroSlideUrls.map((u) => u.trim()).join("|")}
            slides={heroSlideUrls}
          />
          <div className="absolute inset-0 z-[1] bg-white/55" aria-hidden />
          <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6">
            <HomeHeroSlideshowAdminBar />
          </div>
          <div className="container mx-auto relative z-10 py-20 md:py-32">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="secondary" className="mb-4 text-black">
                The Surf Community Marketplace
              </Badge>
              <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl md:text-6xl text-balance">
                Buy and Sell Surfboards with the Community
              </h1>
              <p className="mt-6 text-lg text-muted-foreground text-pretty">
                Find local surfboards, meet sellers in person, and list your own boards with photos and dimensions.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-4">
                <Button size="lg" asChild>
                  <Link href="/boards" prefetch={boardsBrowseLinkPrefetch("/boards")}>
                    Browse surfboards
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/sell">Start Selling</Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Surfboards */}
        {featuredBoards && featuredBoards.length > 0 && (
          <FadeInSection>
          <section className="py-16">
            <div className="container mx-auto">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold">Recently added surfboards</h2>
                  <p className="text-muted-foreground">In-person pickup only</p>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/boards" prefetch={boardsBrowseLinkPrefetch("/boards")}>
                    Find More
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <HomeListingScrollRow uniformCardHeights>
                {featuredBoards.map((board) => (
                  <HomePeerListingScrollTile
                    key={board.id}
                    listing={board}
                    userId={user?.id ?? null}
                    isFavorited={favoritedIds.includes(board.id)}
                  />
                ))}
              </HomeListingScrollRow>
            </div>
          </section>
          </FadeInSection>
        )}

        {/* Features CTA */}
        <section className="py-8">
          <div className="container mx-auto">
            <Link href="/sell" className="no-underline hover:no-underline flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 rounded-2xl bg-primary/5 px-8 py-8 transition-colors hover:bg-primary/10">
              <div>
                <p className="text-lg font-semibold text-foreground">List your surfboard in minutes</p>
                <p className="text-muted-foreground mt-1">
                  Secure payments, verified sellers, direct messaging, and local pickup or shipping — all in one place.
                </p>
              </div>
              <span className="shrink-0 inline-flex items-center gap-2 font-medium text-foreground">
                Start selling
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </section>

        {featuredShortboards && featuredShortboards.length > 0 && (
          <FadeInSection>
            <section className="py-16">
              <div className="container mx-auto">
                <div className="flex items-center justify-between mb-8">
                  <div>
                    <h2 className="text-2xl font-bold">Recently added shortboards</h2>
                    <p className="text-muted-foreground">In-person pickup only</p>
                  </div>
                  <Button variant="outline" asChild>
                    <Link
                      href="/boards?type=shortboard"
                      prefetch={boardsBrowseLinkPrefetch("/boards?type=shortboard")}
                    >
                      Find More
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <HomeListingScrollRow uniformCardHeights>
                  {featuredShortboards.map((board) => (
                    <HomePeerListingScrollTile
                      key={board.id}
                      listing={board}
                      userId={user?.id ?? null}
                      isFavorited={favoritedIds.includes(board.id)}
                    />
                  ))}
                </HomeListingScrollRow>
              </div>
            </section>
          </FadeInSection>
        )}

        {/* Confidence banner */}
        <section className="py-8">
          <div className="container mx-auto">
            <Link href="/contact" className="no-underline hover:no-underline flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 rounded-2xl bg-primary/5 px-8 py-8 transition-colors hover:bg-primary/10">
              <div>
                <p className="text-lg font-semibold text-foreground">Buy and sell with confidence!</p>
                <p className="text-muted-foreground mt-1">
                  All transactions on Reswell are backed by verified sellers and secure payments. Contact our support team anytime for help.
                </p>
              </div>
              <span className="shrink-0 inline-flex items-center gap-2 font-medium text-foreground">
                Contact us
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </section>

        {/* Recently verified — same listing tile as Recently added surfboards (priciest active listing per verified seller) */}
        {verifiedSpotlight.length > 0 && (
          <FadeInSection>
          <section className="py-16 bg-offwhite">
            <div className="container mx-auto">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold">Recently verified users</h2>
                  <p className="text-muted-foreground">
                    Each verified seller&apos;s priciest active surfboard listing right now
                  </p>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/sellers">
                    Browse sellers
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <HomeListingScrollRow uniformCardHeights>
                {verifiedSpotlight.map(({ profile, listing }) => (
                  <HomePeerListingScrollTile
                    key={`${profile.id}-${listing.id}`}
                    listing={listing}
                    userId={user?.id ?? null}
                    isFavorited={favoritedIds.includes(listing.id)}
                  />
                ))}
              </HomeListingScrollRow>
            </div>
          </section>
          </FadeInSection>
        )}

        {/* CTA */}
        <section className="py-8">
          <div className="container mx-auto">
            <Link href="/auth/sign-up" className="no-underline hover:no-underline flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 rounded-2xl bg-primary/5 px-8 py-8 transition-colors hover:bg-primary/10">
              <div>
                <p className="text-lg font-semibold text-foreground">Ready to ride the wave?</p>
                <p className="text-muted-foreground mt-1">
                  Join our community of surfers and start buying, selling, or trading today.
                </p>
              </div>
              <span className="shrink-0 inline-flex items-center gap-2 font-medium text-foreground">
                Create account
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </section>

        {/* Categories — same `HomePeerListingScrollTile` as Recently added surfboards; one listing per `board_type` */}
        {browseCategoryTiles.length > 0 && (
        <FadeInSection>
        <section className="py-16 bg-offwhite">
          <div className="container mx-auto">
            <div className="flex items-center justify-between mb-8">
              <h2 className="text-2xl font-bold">Browse by Category</h2>
              <Button variant="ghost" asChild>
                <Link href="/categories">
                  View All
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <HomeListingScrollRow uniformCardHeights>
              {browseCategoryTiles.map(({ category, listing }) => (
                <HomePeerListingScrollTile
                  key={category.href}
                  listing={listing}
                  userId={user?.id ?? null}
                  isFavorited={favoritedIds.includes(listing.id)}
                />
              ))}
            </HomeListingScrollRow>
          </div>
        </section>
        </FadeInSection>
        )}

        {/* Featured Sellers */}
        {featuredShops && featuredShops.length > 0 && (
          <FadeInSection>
          <section className="py-16">
            <div className="container mx-auto">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold">Featured Sellers</h2>
                  <p className="text-muted-foreground">Browse gear from local retail stores</p>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/sellers">
                    All Sellers
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                {featuredShops.map((shop) => (
                  <Link key={shop.id} href={sellerProfileHref(shop)}>
                    <Card className={cn(listingProductCardClassName, "h-full")}>
                      <div className="h-20 bg-offwhite relative overflow-hidden">
                        {shop.shop_banner_url && (
                          <Image
                            src={shop.shop_banner_url}
                            alt=""
                            fill
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                            className="object-cover"
                            placeholder="blur"
                            blurDataURL={wideShimmer}
                          />
                        )}
                      </div>
                      <CardContent className="p-4 pt-0">
                        <div className="flex items-end gap-3 -mt-6 mb-3">
                          <Avatar className="h-12 w-12 border-2 border-card">
                            <AvatarImage src={shop.shop_logo_url || shop.avatar_url || ""} />
                            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
                              {(shop.shop_name || shop.display_name || "S").charAt(0).toUpperCase()}
                            </AvatarFallback>
                          </Avatar>
                          {shop.shop_verified && (
                            <VerifiedBadge size="md" className="-ml-1 mb-0.5" />
                          )}
                        </div>
                        <h3 className="font-semibold line-clamp-1 text-foreground">
                          {shop.shop_name || shop.display_name}
                        </h3>
                        {(shop.city || shop.shop_address) && (
                          <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground line-clamp-1">
                            <MapPin className="h-3 w-3 flex-shrink-0" />
                            {shop.shop_address || shop.city}
                          </p>
                        )}
                        {shop.shop_description && (
                          <p className="mt-2 text-xs text-muted-foreground line-clamp-2">
                            {shop.shop_description}
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  </Link>
                ))}
              </div>
            </div>
          </section>
          </FadeInSection>
        )}

        {/* Featured New Gear */}
        {featuredNew.length > 0 && (
          <FadeInSection>
          <section className="py-16 bg-offwhite">
            <div className="container mx-auto">
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold">New Arrivals</h2>
                  <p className="text-muted-foreground">Fresh gear from our store</p>
                </div>
                <Button variant="outline" asChild>
                  <Link href="/shop">
                    Shop All
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </Link>
                </Button>
              </div>
              <HomeListingScrollRow uniformCardHeights>
                {featuredNew.map(({ listing, stockQuantity, categoryName }) => (
                  <ShopNewListingStandardTile
                    key={listing.id}
                    layout="homeScroll"
                    listing={{
                      id: listing.id,
                      slug: listing.slug,
                      title: listing.title,
                      price: Number(listing.price),
                      listing_images: listing.listing_images,
                    }}
                    stockQuantity={stockQuantity}
                    userId={user?.id ?? null}
                    isFavorited={favoritedIds.includes(listing.id)}
                    categoryName={categoryName}
                  />
                ))}
              </HomeListingScrollRow>
            </div>
          </section>
          </FadeInSection>
        )}

      </main>
  )
}
