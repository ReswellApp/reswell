import { RecentFeedClient } from "@/components/recent-feed-client"
import { ModelEmptyState } from "@/components/features/models/model-empty-state"
import { ModelTopPick } from "@/components/features/models/model-top-pick"
import type { ModelMarketplaceListing } from "@/lib/db/brand-listings"
import type { BoardSavedSearchCriteria } from "@/lib/validations/boardSavedSearch"

export function ModelListingsSection({
  brandName,
  modelName,
  listings,
  topPick,
  criteria,
  favoritedListingIds,
  isLoggedIn,
  viewerUserId,
}: {
  brandName: string
  modelName: string
  listings: ModelMarketplaceListing[]
  topPick: ModelMarketplaceListing | null
  criteria: BoardSavedSearchCriteria
  favoritedListingIds: string[]
  isLoggedIn: boolean
  viewerUserId: string | null
}) {
  if (listings.length === 0) {
    return (
      <ModelEmptyState
        brandName={brandName}
        modelName={modelName}
        criteria={criteria}
        isLoggedIn={isLoggedIn}
      />
    )
  }

  const gridListings = topPick ? listings.filter((listing) => listing.id !== topPick.id) : listings

  return (
    <div className="space-y-8">
      {topPick ? (
        <ModelTopPick
          listing={topPick}
          isFavorited={favoritedListingIds.includes(topPick.id)}
          isLoggedIn={isLoggedIn}
        />
      ) : null}

      {gridListings.length > 0 ? (
        <section>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Compare {gridListings.length} listing{gridListings.length === 1 ? "" : "s"}
          </h2>
          <div className="mt-4">
            <RecentFeedClient
              listings={gridListings}
              favoritedListingIds={favoritedListingIds}
              isLoggedIn={isLoggedIn}
              viewerUserId={viewerUserId}
              hydrateOwnFavorites
            />
          </div>
        </section>
      ) : null}
    </div>
  )
}
