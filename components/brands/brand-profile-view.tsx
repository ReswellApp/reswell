import type { BrandRow } from "@/lib/brands/types"
import type { BrandPageTab } from "@/lib/brands/routes"
import { BrandDetailAdminBar } from "@/components/brands/brand-detail-admin-bar"
import { BrandPageBreadcrumbs } from "@/components/brands/brand-page-breadcrumbs"
import { BrandPageIntro } from "@/components/brands/brand-page-intro"
import { BrandPageModelsGrid } from "@/components/brands/brand-page-models-grid"
import type { BrandPageModelCard } from "@/lib/brands/model-cards"
import { BrandPageMarketplace } from "@/components/brands/brand-page-marketplace"
import type { RecentListing } from "@/components/recent-feed-client"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"

/**
 * Brand profile — CMS intro, catalog models, and marketplace listings.
 */
export function BrandProfileView({
  brand,
  criteria,
  initialSavedSearchId,
  initialTab,
  catalogModels,
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
  catalogModels: BrandPageModelCard[]
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

        <div className="mt-6 sm:mt-8">
          <BrandPageIntro
            brand={brand}
            criteria={criteria}
            initialSavedSearchId={initialSavedSearchId}
            isLoggedIn={isLoggedIn}
          />
        </div>

        <BrandPageModelsGrid
          brandSlug={brand.slug}
          brandName={brand.name}
          brandLogoUrl={brand.logo_url}
          models={catalogModels}
        />

        <div className="mt-10 border-t border-border/80 pt-10 sm:mt-14 sm:pt-12">
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
      </div>
    </main>
  )
}
