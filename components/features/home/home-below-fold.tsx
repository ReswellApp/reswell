import Link from "next/link"
import { Suspense } from "react"
import { ArrowRight, MapPin } from "lucide-react"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { FadeInSection } from "@/components/fade-in-section"
import { ProfileBannerImage } from "@/components/features/dashboard/profile-banner-image"
import {
  HomeHydratedPeerListingTile,
  HomeHydratedShopNewTile,
  HomeHydratedTrendingBrandsSection,
  HomeListingScrollRow,
  HomeViewerListingScope,
} from "@/components/features/home"
import { ListingTileScrollRowSkeleton } from "@/components/listing-tile-skeleton"
import {
  marketingCtaBannerCtaLabelClassName,
  marketingCtaBannerDescriptionClassName,
  marketingCtaBannerLinkClassName,
  marketingCtaBannerPanelClassName,
  marketingCtaBannerTitleClassName,
} from "@/components/marketing-cta-banners"
import { VerifiedBadge } from "@/components/verified-badge"
import {
  getCachedHomeRecentlyAddedFinsCatalog,
  getCachedHomeRecentlyAddedSurfboardsCatalog,
  getCachedHomeRecentlySoldCatalog,
  getCachedHomeStableCatalog,
  getCachedHomeTrendingBrandsCatalog,
  type HomeFeaturedShop,
} from "@/lib/cache/home-public-catalog"
import { listingProductCardSolidClassName } from "@/lib/listing-card-styles"
import { boardsBrowseLinkPrefetch } from "@/lib/boards-link-prefetch"
import { profileMediaDisplaySrc } from "@/lib/public-media-display-src"
import { sellerProfileHref } from "@/lib/seller-slug"
import { cn } from "@/lib/utils"

function HomeRailSkeleton({ label }: { label: string }) {
  return (
    <section className="py-16" aria-hidden>
      <div className="container mx-auto">
        <div className="skeleton mb-8 h-8 w-56 max-w-full" />
        <ListingTileScrollRowSkeleton />
        <span className="sr-only">Loading {label}</span>
      </div>
    </section>
  )
}

function SellGearCta() {
  return (
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
  )
}

function ContactCta() {
  return (
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
  )
}

function ComeFindABoardCta() {
  return (
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
  )
}

function FeaturedShops({ shops }: { shops: HomeFeaturedShop[] }) {
  if (shops.length === 0) return null

  return (
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
            {shops.map((shop) => (
              <Link key={shop.id} href={sellerProfileHref(shop)}>
                <Card className={cn(listingProductCardSolidClassName, "h-full")}>
                  <div className="relative h-20 overflow-hidden bg-offwhite">
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
                    <div className="-mt-6 mb-3 flex items-end gap-3">
                      <Avatar className="h-12 w-12 border-2 border-card">
                        <AvatarImage
                          src={profileMediaDisplaySrc(shop.shop_logo_url || shop.avatar_url || "")}
                        />
                        <AvatarFallback className="bg-primary text-sm text-primary-foreground">
                          {(shop.shop_name || shop.display_name || "S").charAt(0).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      {shop.shop_verified && <VerifiedBadge size="md" className="-ml-1 mb-0.5" />}
                    </div>
                    <h3 className="line-clamp-1 font-semibold text-foreground">
                      {shop.shop_name || shop.display_name}
                    </h3>
                    {(shop.city || shop.shop_address) && (
                      <p className="mt-0.5 flex items-center gap-1 text-sm text-muted-foreground line-clamp-1">
                        <MapPin className="h-3 w-3 flex-shrink-0" />
                        {shop.shop_address || shop.city}
                      </p>
                    )}
                    {shop.shop_description && (
                      <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{shop.shop_description}</p>
                    )}
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </FadeInSection>
  )
}

async function HomeStableTail() {
  const { featuredShops, featuredNew, featuredListingIds } = await getCachedHomeStableCatalog()

  return (
    <>
      <HomeViewerListingScope ids={featuredListingIds} />
      <FeaturedShops shops={featuredShops ?? []} />
      {featuredNew.length > 0 ? (
        <FadeInSection>
          <section className="bg-offwhite py-16">
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
                  <HomeHydratedShopNewTile
                    key={listing.id}
                    listing={listing}
                    stockQuantity={stockQuantity}
                    categoryName={categoryName}
                  />
                ))}
              </HomeListingScrollRow>
            </div>
          </section>
        </FadeInSection>
      ) : null}
    </>
  )
}

async function HomeSoldAndRest() {
  const { featuredRecentlySold, featuredListingIds } = await getCachedHomeRecentlySoldCatalog()

  return (
    <>
      <HomeViewerListingScope ids={featuredListingIds} />
      {featuredRecentlySold && featuredRecentlySold.length > 0 ? (
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
                  <HomeHydratedPeerListingTile key={board.id} listing={board} />
                ))}
              </HomeListingScrollRow>
            </div>
          </section>
        </FadeInSection>
      ) : null}
      <ComeFindABoardCta />
      <Suspense fallback={<HomeRailSkeleton label="featured sellers" />}>
        <HomeStableTail />
      </Suspense>
    </>
  )
}

async function HomeBoardsAndRest() {
  const { featuredBoards, featuredListingIds } = await getCachedHomeRecentlyAddedSurfboardsCatalog()

  return (
    <>
      <HomeViewerListingScope ids={featuredListingIds} />
      {featuredBoards && featuredBoards.length > 0 ? (
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
                {featuredBoards.map((board) => (
                  <HomeHydratedPeerListingTile key={board.id} listing={board} />
                ))}
              </HomeListingScrollRow>
            </div>
          </section>
        </FadeInSection>
      ) : null}
      <ContactCta />
      <Suspense fallback={<HomeRailSkeleton label="recently sold surfboards" />}>
        <HomeSoldAndRest />
      </Suspense>
    </>
  )
}

async function HomeBrandsAndRest() {
  const { homeTrendingBrandRows } = await getCachedHomeTrendingBrandsCatalog()

  return (
    <>
      <HomeHydratedTrendingBrandsSection rows={homeTrendingBrandRows} />
      <Suspense fallback={<HomeRailSkeleton label="recently added surfboards" />}>
        <HomeBoardsAndRest />
      </Suspense>
    </>
  )
}

async function HomeFinsAndRest() {
  const { featuredFins, featuredListingIds } = await getCachedHomeRecentlyAddedFinsCatalog()

  return (
    <>
      <HomeViewerListingScope ids={featuredListingIds} />
      {featuredFins && featuredFins.length > 0 ? (
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
                  <HomeHydratedPeerListingTile key={fin.id} listing={fin} />
                ))}
              </HomeListingScrollRow>
            </div>
          </section>
        </FadeInSection>
      ) : null}
      <SellGearCta />
      <Suspense fallback={<HomeRailSkeleton label="trending brands" />}>
        <HomeBrandsAndRest />
      </Suspense>
    </>
  )
}

/** Rails under the hero and the recently listed grid. Each catalog streams in page order. */
export function HomeBelowFold() {
  return (
    <Suspense fallback={<HomeRailSkeleton label="recently added fins" />}>
      <HomeFinsAndRest />
    </Suspense>
  )
}
