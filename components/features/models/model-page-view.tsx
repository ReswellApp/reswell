import Link from "next/link"
import { ModelListingsSection } from "@/components/features/models/model-listings-section"
import { ModelPageBreadcrumbs } from "@/components/features/models/model-page-breadcrumbs"
import { ModelPageHeader } from "@/components/features/models/model-page-header"
import { ModelPageViewerProvider } from "@/components/features/models/model-page-viewer"
import { ModelPageSection } from "@/components/features/models/model-page-section"
import { ModelPageTabs } from "@/components/features/models/model-page-tabs"
import { ModelPriceGuidePanel } from "@/components/features/models/model-price-guide-panel"
import { getModelProductDetail, ModelProductDetails } from "@/components/features/models/model-product-details"
import { ModelReviewsPanel } from "@/components/features/models/model-reviews-panel"
import { modelPageSectionId, type ModelPageTab } from "@/lib/models/routes"
import { modelUsedRangeLabel } from "@/lib/models/model-page-hero"
import type { ModelPageData } from "@/lib/services/modelPage"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"

function visibleTabs(input: {
  showListings: boolean
  showPrice: boolean
  showDetails: boolean
  showReviews: boolean
}): ModelPageTab[] {
  const tabs: ModelPageTab[] = []
  if (input.showListings) tabs.push("listings")
  if (input.showPrice) tabs.push("price-guide")
  if (input.showDetails) tabs.push("details")
  if (input.showReviews) tabs.push("reviews")
  return tabs
}

export function ModelPageView({
  page,
  criteria,
  initialSavedSearchId,
  favoritedListingIds,
  isLoggedIn,
  viewerUserId,
}: {
  page: ModelPageData
  criteria: BoardSavedSearchCriteria
  initialSavedSearchId: string | null
  favoritedListingIds: string[]
  isLoggedIn: boolean
  viewerUserId: string | null
}) {
  const listingIds = [...page.listings, ...page.soldListings].map((listing) => listing.id)
  const detail = getModelProductDetail(page)
  const usedRange = modelUsedRangeLabel(page.priceGuide?.typical.low_usd, page.priceGuide?.typical.high_usd)
  const hasSales =
    (page.priceGuide?.recent_sold.length ?? 0) > 0 || page.soldListings.length > 0
  const severalConditions =
    (page.priceGuide?.condition_bands.filter((band) => band.sample_count > 0).length ?? 0) > 1
  const showPrice = hasSales || (Boolean(usedRange) && page.listings.length > 0) || severalConditions
  const showListings = page.listings.length > 0
  const showReviews = page.reviewStats.reviewCount > 0
  const tabs = visibleTabs({
    showListings,
    showPrice,
    showDetails: detail != null,
    showReviews,
  })
  const firstSection = showListings
    ? "listings"
    : showPrice
      ? "price-guide"
      : detail
        ? "details"
        : showReviews
          ? "reviews"
          : null

  return (
    <ModelPageViewerProvider listingIds={listingIds} brandModelId={page.model.id}>
      <main className="flex-1">
        <div className="container mx-auto max-w-6xl px-4 pb-16 pt-6 sm:px-6 sm:pb-20 sm:pt-8">
          <ModelPageBreadcrumbs
            brandName={page.brand.name}
            brandSlug={page.brand.slug}
            modelName={page.model.name}
            categorySlug={page.model.product_category_slug}
          />
          <div className="mt-6">
            <ModelPageHeader page={page} criteria={criteria} anchorDetails={detail == null} />
          </div>
          <ModelPageTabs tabs={tabs} reviewCount={page.reviewStats.reviewCount} />

          {showListings ? (
            <ModelPageSection id={modelPageSectionId("listings")} first={firstSection === "listings"}>
              <ModelListingsSection
                brandName={page.brand.name}
                modelName={page.model.name}
                listings={page.listings}
                topPick={page.topPick}
                criteria={criteria}
                initialSavedSearchId={initialSavedSearchId}
                favoritedListingIds={favoritedListingIds}
                isLoggedIn={isLoggedIn}
                viewerUserId={viewerUserId}
              />
            </ModelPageSection>
          ) : null}
          {showPrice ? (
            <ModelPageSection
              id={modelPageSectionId("price-guide")}
              first={firstSection === "price-guide"}
            >
              <ModelPriceGuidePanel
                page={page.priceGuide}
                soldListings={page.soldListings}
                listingCount={page.listings.length}
                brandSlug={page.brand.slug}
                modelSlug={page.modelSlug}
              />
            </ModelPageSection>
          ) : null}
          {detail ? (
            <ModelPageSection id={modelPageSectionId("details")} first={firstSection === "details"}>
              <ModelProductDetails detail={detail} />
            </ModelPageSection>
          ) : null}
          {showReviews ? (
            <ModelPageSection id={modelPageSectionId("reviews")} first={firstSection === "reviews"} last>
              <ModelReviewsPanel
                reviews={page.reviews}
                avgRating={page.reviewStats.avgRating}
                reviewCount={page.reviewStats.reviewCount}
                modelName={page.model.name}
              />
            </ModelPageSection>
          ) : (
            <p className="mt-10 text-sm text-muted-foreground">
              No reviews for the {page.model.name} yet.{" "}
              <Link
                href="/threads/reviews"
                className="font-medium text-foreground underline-offset-4 hover:underline"
              >
                Write a review
              </Link>
            </p>
          )}
        </div>
      </main>
    </ModelPageViewerProvider>
  )
}
