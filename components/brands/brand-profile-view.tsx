import Image from "next/image"
import Link from "next/link"
import { ExternalLink, MapPin } from "lucide-react"
import {
  BRANDS_BASE,
  brandActiveListingsBrowseHref,
  brandKeywordSearchHref,
  brandSoldListingsBrowseHref,
} from "@/lib/brands/routes"
import type { BrandRow } from "@/lib/brands/types"
import { BrandDetailAdminBar } from "@/components/brands/brand-detail-admin-bar"
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
  return (
    <main className="flex-1">
      <div className="border-b border-border/80 bg-muted/15">
        <div className="container mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={BRANDS_BASE}
              className="inline-flex text-sm font-medium text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              ← Brands
            </Link>
            <BrandDetailAdminBar brand={brand} />
          </div>
        </div>
      </div>

      <header className="border-b border-border/80 bg-card">
        <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-14">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Brand</p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-balance text-foreground sm:text-4xl">
              {brand.name}
            </h1>

            {brand.logo_url ? (
              <div className="relative mx-auto mt-6 h-16 w-44 overflow-hidden rounded-xl border border-border/80 bg-background px-3 py-2 shadow-soft sm:h-[72px] sm:w-48">
                <Image
                  src={brand.logo_url}
                  alt={`${brand.name} logo`}
                  fill
                  className="object-contain object-center"
                  sizes="(max-width: 640px) 176px, 192px"
                  priority
                />
              </div>
            ) : null}

            {brand.location_label ? (
              <p className="mt-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                {brand.location_label}
              </p>
            ) : null}

            {brand.short_description ? (
              <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-[17px]">
                {brand.short_description}
              </p>
            ) : null}

            <dl className="mt-8 grid max-w-lg grid-cols-1 gap-6 text-left sm:mx-auto sm:max-w-none sm:grid-cols-3 sm:gap-8 sm:text-center">
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Founder</dt>
                <dd className="mt-1 text-sm font-medium text-foreground">{brand.founder_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Lead shaper / designer
                </dt>
                <dd className="mt-1 text-sm font-medium text-foreground">{brand.lead_shaper_name ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Models</dt>
                <dd className="mt-1 text-sm font-medium tabular-nums text-foreground">{brand.model_count}</dd>
              </div>
            </dl>

            <div className="mt-10 flex flex-wrap justify-center gap-3">
              {brand.website_url ? (
                <Button asChild className="rounded-full px-6">
                  <a href={brand.website_url} target="_blank" rel="noopener noreferrer">
                    Official site
                    <ExternalLink className="ml-2 h-4 w-4" aria-hidden />
                  </a>
                </Button>
              ) : null}
              <Button asChild variant="outline" className="rounded-full px-6">
                <Link href={brandKeywordSearchHref(brand.name)}>Search listings</Link>
              </Button>
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
          <div className="container mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-12">
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

      <footer className="border-t border-border/80 py-10">
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
