import type { BrandRow } from "@/lib/brands/types"
import type { BrandPageTab } from "@/lib/brands/routes"
import { BrandDetailAdminBar } from "@/components/brands/brand-detail-admin-bar"
import { BrandPageBreadcrumbs } from "@/components/brands/brand-page-breadcrumbs"
import { BrandPageMarketplace } from "@/components/brands/brand-page-marketplace"
import { SaveEntitySearchButton } from "@/components/features/saved-search/save-entity-search-button"
import type { RecentListing } from "@/components/recent-feed-client"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"

/**
 * Brand marketplace — Reverb-style header and listing grid, with a sold feed tab.
 */
export function BrandProfileView({
  brand,
  criteria,
  initialSavedSearchId,
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
  criteria: BoardSavedSearchCriteria
  initialSavedSearchId: string | null
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

        <div className="mt-6 flex flex-col gap-4 sm:mt-8 sm:flex-row sm:items-end sm:justify-between">
          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl">
            {brand.name}
          </h1>
          <SaveEntitySearchButton
            criteria={criteria}
            label="Save this brand"
            savedLabel="Brand saved"
            savedSearchLabel={brand.name}
            successTitle="Brand saved"
            successDescription={`We'll email you when new ${brand.name} gear is listed on Reswell.`}
            isLoggedIn={isLoggedIn}
            initialSavedSearchId={initialSavedSearchId}
          />
        </div>

        <BrandPageMarketplace
          brandSlug={brand.slug}
          brandName={brand.name}
          criteria={criteria}
          initialSavedSearchId={initialSavedSearchId}
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
