import { ModelListingsSection } from "@/components/features/models/model-listings-section"
import { ModelPageBreadcrumbs } from "@/components/features/models/model-page-breadcrumbs"
import { ModelPageHeader } from "@/components/features/models/model-page-header"
import { ModelPageSection } from "@/components/features/models/model-page-section"
import { ModelPageTabs } from "@/components/features/models/model-page-tabs"
import { ModelPriceGuidePanel } from "@/components/features/models/model-price-guide-panel"
import { ModelProductDetails } from "@/components/features/models/model-product-details"
import { ModelReviewsPanel } from "@/components/features/models/model-reviews-panel"
import { modelPageSectionId } from "@/lib/models/routes"
import type { ModelPageData } from "@/lib/services/modelPage"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"

export function ModelPageView({
  page,
  criteria,
  favoritedListingIds,
  isLoggedIn,
  viewerUserId,
}: {
  page: ModelPageData
  criteria: BoardSavedSearchCriteria
  favoritedListingIds: string[]
  isLoggedIn: boolean
  viewerUserId: string | null
}) {
  return (
    <main className="flex-1">
      <div className="container mx-auto max-w-6xl px-4 pt-6 sm:px-6 sm:pt-8">
        <ModelPageBreadcrumbs
          brandName={page.brand.name}
          brandSlug={page.brand.slug}
          modelName={page.model.name}
          categorySlug={page.model.product_category_slug}
        />
        <div className="mt-6">
          <ModelPageHeader page={page} />
        </div>
        <div className="mt-8">
          <ModelPageTabs reviewCount={page.reviewStats.reviewCount} />
        </div>
      </div>

      <ModelPageSection id={modelPageSectionId("listings")} first>
        <ModelListingsSection
          brandName={page.brand.name}
          modelName={page.model.name}
          listings={page.listings}
          soldListings={page.soldListings}
          topPick={page.topPick}
          criteria={criteria}
          favoritedListingIds={favoritedListingIds}
          isLoggedIn={isLoggedIn}
          viewerUserId={viewerUserId}
        />
      </ModelPageSection>
      <ModelPageSection id={modelPageSectionId("details")} tone="muted">
        <ModelProductDetails page={page} />
      </ModelPageSection>
      <ModelPageSection id={modelPageSectionId("price-guide")}>
        <ModelPriceGuidePanel
          page={page.priceGuide}
          brandSlug={page.brand.slug}
          modelSlug={page.modelSlug}
        />
      </ModelPageSection>
      <ModelPageSection id={modelPageSectionId("reviews")} tone="muted" last>
        <ModelReviewsPanel
          reviews={page.reviews}
          avgRating={page.reviewStats.avgRating}
          reviewCount={page.reviewStats.reviewCount}
          modelName={page.model.name}
        />
      </ModelPageSection>
    </main>
  )
}
