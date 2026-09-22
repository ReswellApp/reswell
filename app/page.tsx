import Link from "next/link"
import { HeroBackdrop } from "@/components/hero-backdrop"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { boardsBrowseLinkPrefetch } from "@/lib/boards-link-prefetch"
import { FadeInSection } from "@/components/fade-in-section"
import { HomeBelowFold } from "@/components/features/home/home-below-fold"
import {
  HomeHeroPrimaryCta,
  HomeRecentlyListedGrid,
  HomeViewerProvider,
} from "@/components/features/home"
import { marketingCtaBannerPanelClassName } from "@/components/marketing-cta-banners"
import { resolvePageMetadata } from "@/lib/seo/resolve-page-seo"
import { PageStructuredData } from "@/components/seo/page-structured-data"
import { getCachedHomeRecentlyListedGridCatalog } from "@/lib/cache/home-public-catalog"

export async function generateMetadata() {
  return resolvePageMetadata("home")
}

/**
 * ISR: catalog HTML is the same for everyone. The shell is the hero plus the
 * recently listed grid. Rails below that stream in their own Suspense holes.
 * User-specific state hydrates in HomeViewerProvider after mount.
 */
export const revalidate = 3600

export default async function HomePage() {
  const { recentlyListedGrid, featuredListingIds } = await getCachedHomeRecentlyListedGridCatalog()

  return (
    <HomeViewerProvider listingIds={featuredListingIds}>
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
                <HomeHeroPrimaryCta />
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
                <HomeRecentlyListedGrid listings={recentlyListedGrid} />
              </div>
            </section>
          </FadeInSection>
        ) : null}
        </div>

        <HomeBelowFold />
      </main>
    </HomeViewerProvider>
  )
}
