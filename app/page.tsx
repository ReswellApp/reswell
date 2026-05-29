import Link from "next/link"
import Image from "next/image"
import { wideShimmer } from "@/lib/image-shimmer"
import { HeroSlideshow } from "@/components/hero-slideshow"
import { HomeHeroSlideshowAdminBar } from "@/components/home-hero-slideshow-admin-bar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { createClient } from "@/lib/supabase/server"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ArrowRight, MapPin } from "lucide-react"
import { VerifiedBadge } from "@/components/verified-badge"
import { listingProductCardSolidClassName } from "@/lib/listing-card-styles"
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
import { HomeRecentSectionListingCurator } from "@/components/home-recent-section-listing-curator"
import { ShopNewListingStandardTile } from "@/components/features/marketplace/shop-new-listing-standard-tile"
import {
  marketingCtaBannerCtaLabelClassName,
  marketingCtaBannerDescriptionClassName,
  marketingCtaBannerLinkClassName,
  marketingCtaBannerPanelClassName,
  marketingCtaBannerTitleClassName,
} from "@/components/marketing-cta-banners"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"
import {
  getCachedHomeRecentlySoldCatalog,
  getCachedHomeStableCatalog,
} from "@/lib/cache/home-public-catalog"

export async function generateMetadata() {
  return resolvePageMetadata("home")
}

/** Page ISR matches recently sold strip TTL; stable sections use a longer `unstable_cache` TTL. */
export const revalidate = 3600

export default async function HomePage() {
  const [stableCatalog, recentlySoldCatalog] = await Promise.all([
    getCachedHomeStableCatalog(),
    getCachedHomeRecentlySoldCatalog(),
  ])

  const {
    heroSlideUrls,
    homeTrendingBrandRows,
    featuredShops,
    featuredBoards,
    featuredShortboards,
    featuredNew,
    howItWorksBuyerHighlightImages,
  } = stableCatalog

  const { featuredRecentlySold } = recentlySoldCatalog

  const featuredListingIds = [
    ...stableCatalog.featuredListingIds,
    ...recentlySoldCatalog.featuredListingIds,
  ]

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

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
                Find surfboards locally or from sellers that offer shipping, list your own boards with photos and dimensions, and buy straight from the surf community.
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
                <div className="flex min-w-0 items-center gap-2">
                  <h2 className="text-2xl font-bold">Recently added surfboards</h2>
                  <HomeRecentSectionListingCurator
                    sectionPath="recent-surfboards"
                    isAdmin={isHomeHeroAdmin}
                    buttonLabel="Curate Recently added surfboards"
                    dialogTitle="Recently added surfboards"
                    dialogDescription="When you add picks here, the homepage uses only those surfboard listings, in order. Remove every pick to return to the newest matching listings automatically. Use the crossed-out-eye control to hide listings from everything on the homepage while keeping them searchable elsewhere."
                  />
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
            <Link href="/sell" className={marketingCtaBannerLinkClassName}>
              <div>
                <p className={marketingCtaBannerTitleClassName}>Every board deserves another session</p>
                <p className={marketingCtaBannerDescriptionClassName}>
                  A community of surfers buying, selling, and passing along the boards they love. Find your next board,
                  or send one off to its next.
                </p>
              </div>
              <span className={marketingCtaBannerCtaLabelClassName}>
                List your board
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </section>

        {featuredRecentlySold && featuredRecentlySold.length > 0 && (
          <FadeInSection>
            <section className="py-16">
              <div className="container mx-auto">
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <h2 className="text-2xl font-bold">Recently sold surfboards</h2>
                  </div>
                  <Button variant="outline" asChild>
                    <Link href="/sold">
                      Find More
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <HomeListingScrollRow uniformCardHeights>
                  {featuredRecentlySold.map((board) => (
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

        <TrendingBrandsSection rows={homeTrendingBrandRows} isAdmin={isHomeHeroAdmin} />

        {/* Confidence banner */}
        <section className="py-8">
          <div className="container mx-auto">
            <Link href="/contact" className={marketingCtaBannerLinkClassName}>
              <div>
                <p className={marketingCtaBannerTitleClassName}>We&apos;re here whenever you need us</p>
                <p className={marketingCtaBannerDescriptionClassName}>
                  Real people, real surfers, happy to help with a listing, a question, or just pointing you toward the
                  right board. Say hi anytime.
                </p>
              </div>
              <span className={marketingCtaBannerCtaLabelClassName}>
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
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="text-2xl font-bold">Recently added shortboards</h2>
                    <HomeRecentSectionListingCurator
                      sectionPath="recent-shortboards"
                      isAdmin={isHomeHeroAdmin}
                      buttonLabel="Curate Recently added shortboards"
                      dialogTitle="Recently added shortboards"
                      dialogDescription="When picks exist here, only these shortboards appear on the homepage, in order. Clearing the list restores automatic sorting by newest listings. Homepage-only hiding helps keep stray boards off the homepage without removing site-wide listings."
                    />
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
          <HomeHowItWorksSection
            buyerHighlightImages={howItWorksBuyerHighlightImages}
            isAdmin={isHomeHeroAdmin}
          />
        </FadeInSection>

        {/* CTA below How it works */}
        <section className="pt-8 pb-16 md:pb-20">
          <div className="container mx-auto">
            <div className={marketingCtaBannerPanelClassName}>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <p className={marketingCtaBannerTitleClassName}>Ready to get started?</p>
                  <p className={marketingCtaBannerDescriptionClassName}>
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
                    <Card className={cn(listingProductCardSolidClassName, "h-full")}>
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
                    listing={listing}
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
