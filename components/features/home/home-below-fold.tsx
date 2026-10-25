import Link from "next/link"
import { Fragment, Suspense } from "react"
import { ArrowRight, MapPin } from "lucide-react"
import { ProfileCircle } from "@/components/profile-circle"
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
import type { HomeFeaturedShop } from "@/lib/cache/home-public-catalog"
import { loadHomeFeedSection, visibleHomeFeedSlots } from "@/lib/services/homeFeed"
import type { HomeFeedListingsSection, HomeFeedSectionId } from "@/lib/services/homeFeedPlan"
import { listingProductCardSolidClassName } from "@/lib/listing-card-styles"
import { boardsBrowseLinkPrefetch } from "@/lib/boards-link-prefetch"
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

function FeaturedShops({
  shops,
  title,
  subtitle,
  moreHref,
  moreLabel,
}: {
  shops: HomeFeaturedShop[]
  title: string
  subtitle: string | null
  moreHref: string | null
  moreLabel: string | null
}) {
  if (shops.length === 0) return null

  return (
    <FadeInSection>
      <section className="py-16">
        <div className="container mx-auto">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <h2 className="text-2xl font-bold">{title}</h2>
              {subtitle ? <p className="text-muted-foreground">{subtitle}</p> : null}
            </div>
            {moreHref && moreLabel ? (
              <Button variant="outline" asChild>
                <Link href={moreHref}>
                  {moreLabel}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            ) : null}
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
                      <ProfileCircle
                        avatarUrl={shop.shop_logo_url || shop.avatar_url}
                        className="h-12 w-12 border-2 border-card"
                      />
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

function PeerListingsRail({ section }: { section: HomeFeedListingsSection }) {
  return (
    <FadeInSection>
      <section className="py-16">
        <div className="container mx-auto">
          <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-2xl font-bold">{section.title}</h2>
            {section.moreHref && section.moreLabel ? (
              <Button variant="outline" asChild>
                <Link
                  href={section.moreHref}
                  prefetch={section.moreHref === "/boards" ? boardsBrowseLinkPrefetch("/boards") : undefined}
                >
                  {section.moreLabel}
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            ) : null}
          </div>
          <HomeListingScrollRow uniformCardHeights>
            {section.listings.map((listing) => (
              <HomeHydratedPeerListingTile key={listing.id} listing={listing} />
            ))}
          </HomeListingScrollRow>
        </div>
      </section>
    </FadeInSection>
  )
}

function chromeAfter(id: HomeFeedSectionId) {
  if (id === "recently_added_fins") return <SellGearCta />
  if (id === "recently_added_surfboards") return <ContactCta />
  if (id === "recently_sold") return <ComeFindABoardCta />
  return null
}

async function HomeFeedRail({ id }: { id: HomeFeedSectionId }) {
  const section = await loadHomeFeedSection(id)
  if (!section) return null
  if (section.kind === "listings") {
    return (
      <>
        <HomeViewerListingScope ids={section.listingIds} />
        <PeerListingsRail section={section} />
      </>
    )
  }
  if (section.kind === "brands") {
    return <HomeHydratedTrendingBrandsSection title={section.title} rows={section.brands} />
  }
  if (section.kind === "shops") {
    return (
      <FeaturedShops
        shops={section.shops}
        title={section.title}
        subtitle={section.subtitle}
        moreHref={section.moreHref}
        moreLabel={section.moreLabel}
      />
    )
  }
  return (
    <>
      <HomeViewerListingScope ids={section.listingIds} />
      <FadeInSection>
        <section className="bg-offwhite py-16">
          <div className="container mx-auto">
            <div className="mb-8">
              <h2 className="text-2xl font-bold">
                <Link href={section.href} className="hover:opacity-80">
                  {section.title}
                </Link>
              </h2>
            </div>
            <HomeListingScrollRow uniformCardHeights>
              {section.products.map(({ listing, stockQuantity, categoryName }) => (
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
    </>
  )
}

/** Rails under the hero. Each visible feed slot streams on its own. */
export function HomeBelowFold() {
  const slots = visibleHomeFeedSlots().filter((slot) => slot.id !== "recently_listed")
  return (
    <>
      {slots.map((slot) => (
        <Fragment key={slot.id}>
          <Suspense fallback={<HomeRailSkeleton label={slot.title} />}>
            <HomeFeedRail id={slot.id} />
          </Suspense>
          {chromeAfter(slot.id)}
        </Fragment>
      ))}
    </>
  )
}
