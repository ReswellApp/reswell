import type { BrandRow } from "@/lib/brands/types"
import type { BrandPageTab } from "@/lib/brands/routes"
import { BrandDetailAdminBar } from "@/components/brands/brand-detail-admin-bar"
import { BrandPageBreadcrumbs } from "@/components/brands/brand-page-breadcrumbs"
import { BrandPageMarketplace } from "@/components/brands/brand-page-marketplace"
import type { RecentListing } from "@/components/recent-feed-client"

/**
 * Brand marketplace — Reverb-style header and listing grid, with a sold feed tab.
 */
export function BrandProfileView({
  brand,
  initialTab,
  brandListings,
  brandSoldListings,
  listingsCapped,
  soldCapped,
  favoritedListingIds,
  isLoggedIn,
  viewerUserId,
}: {
  brand: BrandRow
  initialTab: BrandPageTab
  brandListings: RecentListing[]
  brandSoldListings: RecentListing[]
  listingsCapped: boolean
  soldCapped: boolean
  favoritedListingIds: string[]
  isLoggedIn: boolean
  viewerUserId: string | null
}) {
  return (
    <main className="flex-1">
      <div className="container mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-8">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <BrandPageBreadcrumbs brandName={brand.name} />
          <BrandDetailAdminBar brand={brand} />
        </div>

        <h1 className="mt-6 text-4xl font-bold tracking-tight text-foreground sm:mt-8 sm:text-5xl">
          {brand.name}
        </h1>

        <BrandPageMarketplace
          brandSlug={brand.slug}
          brandName={brand.name}
          initialTab={initialTab}
          listings={brandListings}
          soldListings={brandSoldListings}
          listingsCapped={listingsCapped}
          soldCapped={soldCapped}
          favoritedListingIds={favoritedListingIds}
          isLoggedIn={isLoggedIn}
          viewerUserId={viewerUserId}
        />
      </div>
    </main>
  )
}
