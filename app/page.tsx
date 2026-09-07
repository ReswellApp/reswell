import Link from "next/link"
import { HeroBackdrop } from "@/components/hero-backdrop"
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
import { ProfileBannerImage } from "@/components/features/dashboard/profile-banner-image"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import { authLandingHref } from "@/lib/auth/auth-landing-href"
import { boardsBrowseLinkPrefetch } from "@/lib/boards-link-prefetch"
import { FadeInSection } from "@/components/fade-in-section"
import {
  HomeListingScrollRow,
  HomePeerListingScrollTile,
  HomeRecentlyListedGrid,
  TrendingBrandsSection,
} from "@/components/features/home"
import { ShopNewListingStandardTile } from "@/components/features/marketplace/shop-new-listing-standard-tile"
import {
  marketingCtaBannerCtaLabelClassName,
  marketingCtaBannerDescriptionClassName,
  marketingCtaBannerLinkClassName,
  marketingCtaBannerPanelClassName,
  marketingCtaBannerTitleClassName,
} from "@/components/marketing-cta-banners"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"
import { PageStructuredData } from "@/components/seo/page-structured-data"
import {
  getCachedHomeRecentlyAddedFinsCatalog,
  getCachedHomeRecentlyAddedSurfboardsCatalog,
  getCachedHomeRecentlySoldCatalog,
  getCachedHomeRecentlyListedGridCatalog,
  getCachedHomeStableCatalog,
  getCachedHomeTrendingBrandsCatalog,
} from "@/lib/cache/home-public-catalog"

export async function generateMetadata() {
  return resolvePageMetadata("home")
}

/** Page ISR matches recently sold strip TTL; stable sections use a longer `unstable_cache` TTL. Trending brands are tag-only. */
export const revalidate = 3600

export default async function HomePage() {
  const [
    stableCatalog,
    trendingBrandsCatalog,
    recentlyAddedSurfboardsCatalog,
    recentlyAddedFinsCatalog,
    recentlySoldCatalog,
    recentlyListedGridCatalog,
  ] = await Promise.all([
    getCachedHomeStableCatalog(),
    getCachedHomeTrendingBrandsCatalog(),
    getCachedHomeRecentlyAddedSurfboardsCatalog(),
    getCachedHomeRecentlyAddedFinsCatalog(),
    getCachedHomeRecentlySoldCatalog(),
    getCachedHomeRecentlyListedGridCatalog(),
  ])

  const { featuredShops, featuredNew } = stableCatalog
  const { homeTrendingBrandRows } = trendingBrandsCatalog

  const { featuredBoards } = recentlyAddedSurfboardsCatalog
  const { featuredFins } = recentlyAddedFinsCatalog
  const { featuredRecentlySold } = recentlySoldCatalog
  const { recentlyListedGrid } = recentlyListedGridCatalog

  const featuredListingIds = [
    ...stableCatalog.featuredListingIds,
    ...recentlyAddedSurfboardsCatalog.featuredListingIds,
    ...recentlyAddedFinsCatalog.featuredListingIds,
    ...recentlySoldCatalog.featuredListingIds,
    ...recentlyListedGridCatalog.featuredListingIds,
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
        <PageStructuredData pageKey="home" />
        {/* Hero + recently listed grid share a white surface on mobile/tablet (Vinted-style overlap). */}
        <div className="max-lg:bg-white">
        <section className="relative overflow-hidden lg:flex lg:min-h-[max(34rem,min(72svh,42rem))] lg:items-center">
          <HeroBackdrop />
          <div
            className="absolute inset-x-0 top-0 z-[1] max-lg:h-[42svh] sm:max-lg:h-[46svh] md:max-lg:h-[50svh] max-lg:bg-gradient-to-b max-lg:from-black/5 max-lg:via-transparent max-lg:to-white/10 lg:inset-0 lg:h-full lg:bg-white/15"
            aria-hidden
          />
          <div className="relative z-10 w-full lg:container lg:mx-auto lg:py-20">
            {/* Mobile/tablet: show backdrop above the sheet */}
            <div
              className="min-h-[34svh] sm:min-h-[38svh] md:min-h-[42svh] lg:hidden"
              aria-hidden
            />
            <div
              className={cn(
                marketingCtaBannerPanelClassName,
                "relative shadow-md shadow-foreground/5",
                "max-lg:-mt-12 max-lg:rounded-none max-lg:rounded-t-3xl max-lg:border-x-0 max-lg:border-b-0 max-lg:px-6 max-lg:py-8 max-lg:pb-9 max-lg:text-center max-lg:shadow-[0_-8px_32px_rgba(0,0,0,0.08)] sm:max-lg:px-8 md:max-lg:px-10",
                "lg:mx-0 lg:mr-auto lg:max-w-sm lg:rounded-2xl lg:border lg:px-6 lg:py-6 lg:text-left xl:max-w-md",
              )}
            >
              <Badge variant="secondary" className="mb-3.5 text-black md:mb-4 max-lg:mx-auto">
                Used surfboard marketplace
              </Badge>
              <h1 className="text-[1.75rem] font-bold leading-tight tracking-tight text-foreground text-balance sm:text-4xl md:text-[2.375rem] lg:text-4xl lg:leading-tight xl:text-[2.625rem]">
                The marketplace for surfers
              </h1>
              <p className="mt-4 text-base text-muted-foreground text-pretty sm:mt-5 sm:text-lg lg:mt-4 lg:text-base">
                Join surfers buying and selling surf gear.
              </p>
              <div className="mt-6 flex flex-col items-stretch justify-center gap-3 sm:mt-7 sm:gap-3.5 lg:mt-6 lg:justify-start">
                {user ? (
                  <Button size="lg" className="w-full" asChild>
                    <Link href="/sell">Start Selling</Link>
                  </Button>
                ) : (
                  <Button size="lg" className="w-full" asChild>
                    <Link href={authLandingHref("/auth/sign-up")}>Sign up</Link>
                  </Button>
                )}
                <Button size="lg" variant="outline" className="w-full lg:w-full" asChild>
                  <Link href="/boards" prefetch={boardsBrowseLinkPrefetch("/boards")}>
                    Browse surfboards
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
                <Button size="lg" variant="outline" className="w-full lg:w-full" asChild>
                  <Link href="/cities">
                    Browse by city
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </section>

        {recentlyListedGrid && recentlyListedGrid.length > 0 ? (
          <FadeInSection>
            <section className="max-lg:pt-6 max-lg:pb-12 lg:py-16">
              <div className="container mx-auto max-lg:px-4 sm:max-lg:px-6">
                <div className="mb-4 flex min-w-0 items-center justify-between lg:mb-8">
                  <h2 className="text-2xl font-bold">Recently listed</h2>
                </div>
                <HomeRecentlyListedGrid
                  listings={recentlyListedGrid}
                  userId={user?.id ?? null}
                  favoritedIds={favoritedIds}
                />
              </div>
            </section>
          </FadeInSection>
        ) : null}
        </div>

        {featuredFins && featuredFins.length > 0 && (
          <FadeInSection>
            <section className="py-16">
              <div className="container mx-auto">
                <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="text-2xl font-bold">Recently added fins</h2>
                  </div>
                  <Button variant="outline" asChild>
                    <Link href="/fins">
                      Find More
                      <ArrowRight className="ml-1 h-4 w-4" />
                    </Link>
                  </Button>
                </div>
                <HomeListingScrollRow uniformCardHeights>
                  {featuredFins.map((fin) => (
                    <HomePeerListingScrollTile
                      key={fin.id}
                      listing={fin}
                      userId={user?.id ?? null}
                      isFavorited={favoritedIds.includes(fin.id)}
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
                <h2 className={marketingCtaBannerTitleClassName}>Gear that deserves another session</h2>
                <p className={marketingCtaBannerDescriptionClassName}>
                  A community of surfers buying, selling, and passing along the boards and gear they love. Find your
                  next setup, or send one off to its next owner.
                </p>
              </div>
              <span className={marketingCtaBannerCtaLabelClassName}>
                List your gear
                <ArrowRight className="h-4 w-4" />
              </span>
            </Link>
          </div>
        </section>

        <TrendingBrandsSection rows={homeTrendingBrandRows} isAdmin={isHomeHeroAdmin} />

        {/* Featured Surfboards */}
        {featuredBoards && featuredBoards.length > 0 && (
          <FadeInSection>
          <section className="py-16">
            <div className="container mx-auto">
              <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2">
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
                {featuredBoards.map((board, tileIdx) => (
                  <HomePeerListingScrollTile
                    key={board.id}
                    listing={board}
                    userId={user?.id ?? null}
                    isFavorited={favoritedIds.includes(board.id)}
                    imagePriority={tileIdx === 0}
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
            <Link href="/contact" className={marketingCtaBannerLinkClassName}>
              <div>
                <h2 className={marketingCtaBannerTitleClassName}>We&apos;re here whenever you need us</h2>
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

        {/* Ready to get started CTA */}
        <section className="pt-8 pb-16 md:pb-20">
          <div className="container mx-auto">
            <div className={marketingCtaBannerPanelClassName}>
              <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0">
                  <h2 className={marketingCtaBannerTitleClassName}>Come find a board</h2>
                  <p className={marketingCtaBannerDescriptionClassName}>
                    Browse used boards and gear from surfers — or list one and send it on its next session.
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
                    <Link href="/sell">List your gear</Link>
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
                          <ProfileBannerImage
                            bannerUrl={shop.shop_banner_url}
                            focalX={shop.shop_banner_focal_x_pct}
                            focalY={shop.shop_banner_focal_y_pct}
                            sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 20vw"
                            placeholder="blur"
                          />
                        )}
                      </div>
                      <CardContent className="p-4 pt-0">
                        <div className="flex items-end gap-3 -mt-6 mb-3">
                          <Avatar className="h-12 w-12 border-2 border-card">
                            <AvatarImage
                              src={profileMediaDisplaySrc(
                                shop.shop_logo_url || shop.avatar_url || "",
                              )}
                            />
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
              <div className="mb-8">
                <h2 className="text-2xl font-bold">
                  <Link href="/reswell/shop" className="hover:opacity-80">
                    Shop From Reswell
                  </Link>
                </h2>
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
