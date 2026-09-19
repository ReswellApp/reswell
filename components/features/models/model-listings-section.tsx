import { ModelEmptyState } from "@/components/features/models/model-empty-state"
import { ModelListingsStrip } from "@/components/features/models/model-listings-strip"
import { ModelTopPick } from "@/components/features/models/model-top-pick"
import { SaveEntitySearchCta } from "@/components/features/saved-search/save-entity-search-cta"
import type { ModelMarketplaceListing } from "@/lib/db/brand-listings"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"

export function ModelListingsSection({
  brandName,
  modelName,
  listings,
  soldListings,
  topPick,
  criteria,
  initialSavedSearchId,
  favoritedListingIds,
  isLoggedIn,
  viewerUserId,
}: {
  brandName: string
  modelName: string
  listings: ModelMarketplaceListing[]
  soldListings: ModelMarketplaceListing[]
  topPick: ModelMarketplaceListing | null
  criteria: BoardSavedSearchCriteria
  initialSavedSearchId: string | null
  favoritedListingIds: string[]
  isLoggedIn: boolean
  viewerUserId: string | null
}) {
  if (listings.length === 0 && soldListings.length === 0) {
    return (
      <ModelEmptyState
        brandName={brandName}
        modelName={modelName}
        criteria={criteria}
        isLoggedIn={isLoggedIn}
        initialSavedSearchId={initialSavedSearchId}
      />
    )
  }

  return (
    <div className="space-y-8">
      {topPick ? (
        <ModelTopPick
          listing={topPick}
          isFavorited={favoritedListingIds.includes(topPick.id)}
          isLoggedIn={isLoggedIn}
        />
      ) : listings.length === 0 ? (
        <SaveEntitySearchCta
          heading={`No ${brandName} ${modelName} for sale right now`}
          description={`Save this model and we'll email you when one is listed on Reswell.`}
          criteria={criteria}
          label="Save this model"
          savedLabel="Model saved"
          savedSearchLabel={`${brandName} ${modelName}`}
          successTitle="Model saved"
          successDescription={`We'll email you when a ${brandName} ${modelName} is listed on Reswell.`}
          isLoggedIn={isLoggedIn}
          initialSavedSearchId={initialSavedSearchId}
        />
      ) : null}

      <ModelListingsStrip
        heading={`Live ${modelName} listings`}
        countLabel={listings.length > 0 ? `${listings.length} for sale` : undefined}
        listings={listings}
        favoritedListingIds={favoritedListingIds}
        viewerUserId={viewerUserId}
      />

      <ModelListingsStrip
        heading="Recent sales"
        countLabel={
          soldListings.length > 0
            ? `${soldListings.length} sale${soldListings.length === 1 ? "" : "s"}`
            : undefined
        }
        listings={soldListings}
        favoritedListingIds={favoritedListingIds}
        viewerUserId={viewerUserId}
        statusLabel="sold"
      />
    </div>
  )
}
