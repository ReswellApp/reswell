import Link from "next/link"
import { ArrowRight, MapPin } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  HomeHydratedTrendingBrandsSection,
  HomeRecentlyListedGrid,
  HomeViewerProvider,
} from "@/components/features/home"
import { getCachedHomeRecentlyListedGridCatalog, getCachedHomeTrendingBrandsCatalog } from "@/lib/cache/home-public-catalog"
import { getCachedTopCitiesDirectory } from "@/lib/cache/top-cities-directory"
import { EXPLORE_CITY_PREVIEW_COUNT } from "@/lib/explore-page"
import { boardsBrowseLinkPrefetch } from "@/lib/boards-link-prefetch"

export async function ExploreCatalog() {
  const [recentlyListed, trendingBrands, cities] = await Promise.all([
    getCachedHomeRecentlyListedGridCatalog(),
    getCachedHomeTrendingBrandsCatalog(),
    getCachedTopCitiesDirectory(),
  ])

  const listings = recentlyListed.recentlyListedGrid ?? []
  const cityPreview = cities.cities.slice(0, EXPLORE_CITY_PREVIEW_COUNT)

  return (
    <HomeViewerProvider listingIds={recentlyListed.featuredListingIds}>
      {listings.length > 0 ? (
        <section className="border-b border-border/60 py-10 sm:py-14" aria-labelledby="explore-recent-heading">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-center sm:justify-between">
              <h2 id="explore-recent-heading" className="text-2xl font-bold">
                Recently listed
              </h2>
              <Button variant="outline" asChild>
                <Link href="/boards" prefetch={boardsBrowseLinkPrefetch("/boards")}>
                  Browse surfboards
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <HomeRecentlyListedGrid listings={listings} />
          </div>
        </section>
      ) : null}

      <HomeHydratedTrendingBrandsSection rows={trendingBrands.homeTrendingBrandRows} />

      {cityPreview.length > 0 ? (
        <section className="border-t border-border/60 py-10 sm:py-14" aria-labelledby="explore-cities-heading">
          <div className="container mx-auto px-4 sm:px-6">
            <div className="mb-6 flex flex-col gap-4 sm:mb-8 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <h2 id="explore-cities-heading" className="text-2xl font-bold">
                  Cities with listings
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  {cities.totalCities.toLocaleString()} cit{cities.totalCities === 1 ? "y" : "ies"} ·{" "}
                  {cities.totalListings.toLocaleString()} active listing
                  {cities.totalListings === 1 ? "" : "s"}
                </p>
              </div>
              <Button variant="outline" asChild>
                <Link href="/cities/top">
                  All cities
                  <ArrowRight className="ml-1 h-4 w-4" />
                </Link>
              </Button>
            </div>
            <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {cityPreview.map((city) => (
                <li key={city.key}>
                  <Link
                    href={city.href}
                    className="flex h-full flex-col rounded-2xl border border-border/70 p-4 transition-colors hover:border-foreground/20 hover:bg-offwhite"
                  >
                    <span className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
                      <MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                      <span className="line-clamp-1">{city.label}</span>
                    </span>
                    <span className="mt-2 text-sm text-muted-foreground">
                      {city.listingCount.toLocaleString()} listing{city.listingCount === 1 ? "" : "s"}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      ) : null}
    </HomeViewerProvider>
  )
}
