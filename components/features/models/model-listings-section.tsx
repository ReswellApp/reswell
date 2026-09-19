import { ModelEmptyState } from "@/components/features/models/model-empty-state"
import { ModelListingsStrip } from "@/components/features/models/model-listings-strip"
import { ModelTopPick } from "@/components/features/models/model-top-pick"
import type { ModelMarketplaceListing } from "@/lib/db/brand-listings"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"

export function ModelListingsSection({
  brandName,
  modelName,
  listings,
  soldListings,
  topPick,
  criteria,
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
        <p className="text-sm text-muted-foreground">
          No {brandName} {modelName} listings for sale right now.
        </p>
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
