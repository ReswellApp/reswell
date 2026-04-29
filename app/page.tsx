import Link from "next/link"
import Image from "next/image"
import { wideShimmer } from "@/lib/image-shimmer"
import { FALLBACK_HOME_HERO_SLIDE_PATHS, HeroSlideshow } from "@/components/hero-slideshow"
import { HomeHeroSlideshowAdminBar } from "@/components/home-hero-slideshow-admin-bar"
import { normalizeHeroSlideUrl } from "@/lib/home-hero-slide-urls"
import { listHomeHeroCuratedSlideUrls } from "@/lib/db/home-hero-listings"
import { listHowItWorksBuyerListingImageUrls } from "@/lib/db/home-how-it-works-buyer-images"
import { listingHeroSlideSrc, type ListingImageForCard } from "@/lib/listing-image-display"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowRight, MapPin } from "lucide-react"
import { VerifiedBadge } from "@/components/verified-badge"
import { listingProductCardClassName } from "@/lib/listing-card-styles"
import { cn } from "@/lib/utils"
import { sellerProfileHref } from "@/lib/seller-slug"
import { boardsBrowseLinkPrefetch } from "@/lib/boards-link-prefetch"
import { FadeInSection } from "@/components/fade-in-section"
import {
  HomeHowItWorksSection,
  HomeListingScrollRow,
  HomePeerListingScrollTile,
  TrendingBrandsSection,
} from "@/components/features/home"
import { listHomeTrendingBrandsForPublicService } from "@/lib/services/homeTrendingBrands"
import { ShopNewListingStandardTile } from "@/components/features/marketplace/shop-new-listing-standard-tile"
import { pageSeoMetadata } from "@/lib/site-metadata"

export const metadata = pageSeoMetadata({
  title: "Reswell — Buy & sell surfboards",
  description:
    "Peer-to-peer surfboard marketplace: list your board, browse local shapes, and shop new items from verified sellers.",
  path: "/",
})

const profilePublicFields =
  "id, seller_slug, display_name, avatar_url, location, city, bio, created_at, updated_at, is_shop, shop_name, shop_description, shop_banner_url, shop_logo_url, shop_verified, shop_website, shop_phone, shop_address, sales_count"

const listingWithProfileSelect = `
  *,
  listing_images (url, thumbnail_url, sort_order, is_primary),
  profiles!listings_user_id_fkey (display_name, avatar_url, location, sales_count, shop_verified),
  categories (name)
`

const featuredNewSelect = `
  id,
  slug,
  title,
  price,
  listing_images (url, thumbnail_url, sort_order, is_primary),
  inventory (quantity),
  categories (name)
`

export const dynamic = "force-dynamic"

export default async function HomePage() {
  const supabase = await createClient()

  // Admins can curate specific listings in `home_hero_listings`. When any curated rows exist,
  // the hero uses ONLY those images (already filtered to active + visible). Otherwise, fall
  // back to the most-recent active surfboard listings, then to static assets.
  const [
    curatedHeroUrls,
    homeTrendingBrandRows,
    featuredShopsRes,
    boardsRes,
    shortBoardsRes,
    newGearRes,
    authRes,
    howItWorksBuyerImageUrls,
  ] = await Promise.all([
    listHomeHeroCuratedSlideUrls(supabase),
    listHomeTrendingBrandsForPublicService(supabase),
    supabase
      .from("profiles")
      .select(profilePublicFields)
      .eq("is_shop", true)
      .order("sales_count", { ascending: false })
      .order("shop_verified", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(4),
    supabase
      .from("listings")
      .select(listingWithProfileSelect)
      .eq("status", "active")
      .eq("section", "surfboards")
      .eq("hidden_from_site", false)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("listings")
      .select(listingWithProfileSelect)
      .eq("status", "active")
      .eq("section", "surfboards")
      .eq("board_type", "shortboard")
      .eq("hidden_from_site", false)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("listings")
      .select(featuredNewSelect)
      .eq("section", "new")
      .eq("status", "active")
      .eq("hidden_from_site", false)
      .order("created_at", { ascending: false })
      .limit(12),
    supabase.auth.getUser(),
    listHowItWorksBuyerListingImageUrls(supabase),
  ])

  const howItWorksBuyerHighlightImages = {
    shortboard: howItWorksBuyerImageUrls.shortboard ?? "/images/home/hero-slide-5.png",
    hybrid: howItWorksBuyerImageUrls.hybrid ?? "/images/home/hero-slide-6.png",
    longboard: howItWorksBuyerImageUrls.longboard ?? "/images/home/hero-slide-4.png",
  }

  const useCuratedHeroOnly = curatedHeroUrls.length > 0
  const heroListingsRes = useCuratedHeroOnly
    ? { data: null as { listing_images: unknown }[] | null }
    : await supabase
        .from("listings")
        .select("listing_images (url, is_primary)")
        .eq("status", "active")
        .eq("section", "surfboards")
        .eq("hidden_from_site", false)
        .order("created_at", { ascending: false })
        .limit(24)

  const { data: featuredShops } = featuredShopsRes
  const { data: rawFeaturedBoards } = boardsRes
  const { data: rawFeaturedShortboards } = shortBoardsRes
  const { data: rawFeaturedNew } = newGearRes
  const {
    data: { user },
  } = authRes

  const heroSlideUrls: string[] = []
  if (useCuratedHeroOnly) {
    const heroSeen = new Set<string>()
    for (const src of curatedHeroUrls) {
      const key = normalizeHeroSlideUrl(src)
      if (!key || heroSeen.has(key)) continue
      heroSeen.add(key)
      heroSlideUrls.push(src)
    }
  } else {
    const heroListingCandidates = heroListingsRes.data
    const heroSeen = new Set<string>()
    for (const row of heroListingCandidates ?? []) {
      const src = listingHeroSlideSrc(row.listing_images as ListingImageForCard[] | null)
      if (!src) continue
      const key = normalizeHeroSlideUrl(src)
      if (!key || heroSeen.has(key)) continue
      heroSeen.add(key)
      heroSlideUrls.push(src)
      if (heroSlideUrls.length >= 5) break
    }
  }
  if (heroSlideUrls.length === 0) {
    heroSlideUrls.push(...FALLBACK_HOME_HERO_SLIDE_PATHS)
  }

  const featuredBoards = rawFeaturedBoards
    ? [...rawFeaturedBoards]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20)
    : null

  const featuredShortboards = rawFeaturedShortboards
    ? [...rawFeaturedShortboards]
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 20)
    : null

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

  const featuredListingIds = [
    ...(featuredBoards ?? []).map((b) => b.id),
    ...(featuredShortboards ?? []).map((b) => b.id),
    ...featuredNew.map(({ listing: l }) => l.id),
  ]

  const [favoritesRes, adminRes] = await Promise.all([
    user && featuredListingIds.length > 0
      ? supabase
          .from("favorites")
          .select("listing_id")
          .eq("user_id", user.id)
          .in("listing_id", featuredListingIds)
      : Promise.resolve({ data: null as { listing_id: string }[] | null }),
    user
      ? supabase.from("profiles").select("is_admin").eq("id", user.id).maybeSingle()
      : Promise.resolve({ data: null as { is_admin: boolean | null } | null }),
  ])

  const favoritedIds = (favoritesRes.data ?? []).map((f) => f.listing_id)
  const isHomeHeroAdmin = adminRes.data?.is_admin === true

  return (
      <main className="flex-1">
        {/* CLS-FIX: min-height + svh keeps the hero band stable while the slideshow loads. */}
        <section className="relative flex min-h-[max(19.5rem,51svh)] items-center overflow-hidden sm:min-h-[max(21.5rem,51svh)] md:min-h-[max(34rem,min(72svh,42rem))]">
          <HeroSlideshow
            key={heroSlideUrls.map((u) => u.trim()).join("|")}
            slides={heroSlideUrls}
          />
          <div className="absolute inset-0 z-[1] bg-white/55" aria-hidden />
          {/* Admin-only CMS control (renders nothing for non-admins). Positioned top-right of the
              hero with safe-area padding so the + button never collides with the header. */}
          {/* Sticky site header is z-50 — hero CMS control must sit above it when the bar overlaps. */}
          <div className="pointer-events-none absolute right-3 top-3 z-[60] flex sm:right-5 sm:top-5">
            <div className="pointer-events-auto">
              <HomeHeroSlideshowAdminBar isAdmin={isHomeHeroAdmin} />
            </div>
          </div>
          <div className="container mx-auto relative z-10 py-12 sm:py-14 md:py-32">
            <div className="mx-auto max-w-3xl text-center">
              <Badge variant="secondary" className="mb-3.5 text-black md:mb-4">
                Used surfboard marketplace
              </Badge>
              <h1 className="text-[2.0625rem] font-bold leading-tight tracking-tight text-foreground sm:text-5xl md:text-6xl sm:leading-none text-balance">
                Buy and Sell Surfboards with the Community
              </h1>
              <p className="mt-5 text-base text-muted-foreground text-pretty sm:text-lg">
                Find local surfboards, meet sellers in person, and list your own boards with photos and dimensions.
              </p>
              <div className="mt-7 flex flex-col sm:flex-row items-center justify-center gap-3.5 md:mt-8 md:gap-4">
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
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="text-2xl font-bold">Recently added surfboards</h2>
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
                <p className="text-lg font-semibold text-foreground">Every board deserves another session</p>
                <p className="text-muted-foreground mt-1">
                  A community of surfers buying, selling, and passing along the boards they love. Find your next board,
                  or send one off to its next.
                </p>
              </div>
              <span className="shrink-0 inline-flex items-center gap-2 font-medium text-foreground">
                List your board
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </section>

        <TrendingBrandsSection rows={homeTrendingBrandRows} isAdmin={isHomeHeroAdmin} />

        {/* Confidence banner */}
        <section className="py-8">
          <div className="container mx-auto">
            <Link href="/contact" className="no-underline hover:no-underline flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 rounded-2xl bg-primary/5 px-8 py-8 transition-colors hover:bg-primary/10">
              <div>
                <p className="text-lg font-semibold text-foreground">We&apos;re here whenever you need us</p>
                <p className="text-muted-foreground mt-1">
                  Real people, real surfers, happy to help with a listing, a question, or just pointing you toward the
                  right board. Say hi anytime.
                </p>
              </div>
              <span className="shrink-0 inline-flex items-center gap-2 font-medium text-foreground">
                Say hello
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </section>

        {featuredShortboards && featuredShortboards.length > 0 && (
          <FadeInSection>
            <section className="py-16">
              <div className="container mx-auto">
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-2xl font-bold">Recently added shortboards</h2>
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

        <FadeInSection>
          <HomeHowItWorksSection buyerHighlightImages={howItWorksBuyerHighlightImages} />
        </FadeInSection>

        {/* CTA below How it works */}
        <section className="py-8">
          <div className="container mx-auto">
            <div className="rounded-2xl bg-primary/5 px-6 py-8 sm:px-8">
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className="text-lg font-semibold text-foreground">Ready to get started?</p>
                  <p className="mt-1 text-muted-foreground text-pretty">
                    Browse boards from locals and shops, or list yours with photos and pickup options in a few minutes.
                  </p>
                </div>
                <div className="flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center">
                  <Button size="lg" asChild>
                    <Link href="/boards" prefetch={boardsBrowseLinkPrefetch("/boards")}>
                      Browse surfboards
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Link>
                  </Button>
                  <Button size="lg" variant="outline" asChild>
                    <Link href="/sell">List your board</Link>
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Featured Sellers */}
        {featuredShops && featuredShops.length > 0 && (
          <FadeInSection>
          <section className="py-16">
            <div className="container mx-auto">
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
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
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
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
