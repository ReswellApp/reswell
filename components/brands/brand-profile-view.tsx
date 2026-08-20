import Link from "next/link"
import { ExternalLink, MapPin } from "lucide-react"
import {
  BRANDS_BASE,
  brandActiveListingsBrowseHref,
  brandKeywordSearchHref,
  brandSoldListingsBrowseHref,
} from "@/lib/brands/routes"
import type { BrandRow } from "@/lib/brands/types"
import { BrandLogoMark } from "@/components/brands/brand-logo-mark"
import { BrandDetailAdminBar } from "@/components/brands/brand-detail-admin-bar"
import { BrandProductCategoryBadges } from "@/components/brands/brand-product-category-badges"
import { Button } from "@/components/ui/button"
import type { RecentListing } from "@/components/recent-feed-client"
import { BrandMarketplaceListingsPreview } from "@/components/brands/brand-marketplace-listings-preview"

/**
 * Brand detail — directory fields from `public.brands`; CTAs use keyword `/search?q={name}`;
 * listing preview uses the same surfboard query as search.
 */
export function BrandProfileView({
  brand,
  brandListingsPreview,
  brandSoldListingsPreview,
  favoritedListingIds,
  isLoggedIn,
  viewerUserId,
}: {
  brand: BrandRow
  brandListingsPreview: RecentListing[]
  brandSoldListingsPreview: RecentListing[]
  favoritedListingIds: string[]
  isLoggedIn: boolean
  viewerUserId: string | null
}) {
  const metaBits = [
    brand.founder_name ? `Founded by ${brand.founder_name}` : null,
    brand.lead_shaper_name ? `Shaped by ${brand.lead_shaper_name}` : null,
    brand.model_count > 0
      ? `${brand.model_count} model${brand.model_count === 1 ? "" : "s"}`
      : null,
  ].filter((bit): bit is string => bit != null)

  return (
    <main className="flex-1">
      <header className="border-b border-border/80">
        <div className="container mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6">
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <Link
              href={BRANDS_BASE}
              className="inline-flex text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              ← Brands
            </Link>
            <BrandDetailAdminBar brand={brand} />
          </div>

          <div className="flex gap-4 sm:gap-5">
            <BrandLogoMark
              name={brand.name}
              logoUrl={brand.logo_url}
              className="h-14 w-14 rounded-lg text-lg sm:h-16 sm:w-16 sm:rounded-xl sm:text-xl"
              imageSizes="64px"
            />

            <div className="min-w-0 flex-1">
              <h1 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {brand.name}
              </h1>

              {brand.location_label ? (
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span className="truncate">{brand.location_label}</span>
                </p>
              ) : null}

              {brand.short_description ? (
                <p className="mt-2.5 max-w-2xl text-sm leading-relaxed text-muted-foreground">
                  {brand.short_description}
                </p>
              ) : null}

              {metaBits.length > 0 ? (
                <p className="mt-2 text-xs text-muted-foreground/90">
                  {metaBits.join(" · ")}
                </p>
              ) : null}

              {brand.product_categories.length > 0 ? (
                <BrandProductCategoryBadges
                  categories={brand.product_categories}
                  className="mt-3"
                  size="sm"
                />
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                {brand.website_url ? (
                  <Button asChild size="sm" variant="outline">
                    <a href={brand.website_url} target="_blank" rel="noopener noreferrer">
                      Official site
                      <ExternalLink className="ml-1.5 h-3.5 w-3.5" aria-hidden />
                    </a>
                  </Button>
                ) : null}
                <Button asChild size="sm" variant="outline">
                  <Link href={brandKeywordSearchHref(brand.name)}>Search listings</Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {brandListingsPreview.length > 0 || brandSoldListingsPreview.length > 0 ? (
        <section
          id="listings"
          className="scroll-mt-28 border-b border-border/80 bg-background sm:scroll-mt-32"
          aria-label="Listings"
        >
          <div className="container mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
            <BrandMarketplaceListingsPreview
              liveListings={brandListingsPreview}
              soldListings={brandSoldListingsPreview}
              favoritedListingIds={favoritedListingIds}
              isLoggedIn={isLoggedIn}
              viewerUserId={viewerUserId}
              viewAllActiveHref={brandActiveListingsBrowseHref(brand)}
              viewSoldHref={brandSoldListingsBrowseHref(brand)}
            />
          </div>
        </section>
      ) : null}

      <footer className="border-t border-border/80 py-6">
        <div className="container mx-auto max-w-6xl px-4 sm:px-6">
          <p className="text-sm text-muted-foreground">
            <Link href={BRANDS_BASE} className="font-medium text-foreground underline-offset-4 hover:underline">
              Back to Brands
            </Link>
            {" · "}
            <Link href="/gear" className="font-medium text-foreground underline-offset-4 hover:underline">
              Browse used
            </Link>
          </p>
        </div>
      </footer>
    </main>
  )
}
