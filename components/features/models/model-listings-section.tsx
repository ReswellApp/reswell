"use client"

import { RecentFeedClient } from "@/components/recent-feed-client"
import { useModelPageViewer } from "@/components/features/models/model-page-viewer"
import { ModelEmptyState } from "@/components/features/models/model-empty-state"
import { ModelPageSectionHeading } from "@/components/features/models/model-page-section"
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
  const viewer = useModelPageViewer()
  const favoritedIds = viewer.ready ? viewer.favoritedIds : favoritedListingIds
  const loggedIn = viewer.ready ? viewer.isLoggedIn : isLoggedIn
  const userId = viewer.ready ? viewer.userId : viewerUserId
  const savedSearchId = viewer.ready ? viewer.savedSearchId : initialSavedSearchId

  if (listings.length === 0 && soldListings.length === 0) {
    return (
      <ModelEmptyState
        brandName={brandName}
        modelName={modelName}
        criteria={criteria}
        isLoggedIn={loggedIn}
        initialSavedSearchId={savedSearchId}
      />
    )
  }

  const showTopPick = Boolean(topPick && listings.length >= 3)

  return (
    <div className="space-y-10">
      {showTopPick && topPick ? (
        <ModelTopPick
          listing={topPick}
          isFavorited={favoritedIds.includes(topPick.id)}
          isLoggedIn={loggedIn}
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
          isLoggedIn={loggedIn}
          initialSavedSearchId={savedSearchId}
        />
      ) : null}

      {listings.length > 0 ? (
        <div>
          <ModelPageSectionHeading>For sale</ModelPageSectionHeading>
          <p className="mt-1 text-sm text-muted-foreground">
            {listings.length} listing{listings.length === 1 ? "" : "s"}
          </p>
          <div className="mt-6">
            <RecentFeedClient
              listings={listings}
              favoritedListingIds={favoritedIds}
              isLoggedIn={loggedIn}
              viewerUserId={userId}
            />
          </div>
        </div>
      ) : null}

      {soldListings.length > 0 ? (
        <div>
          <ModelPageSectionHeading>Recently sold</ModelPageSectionHeading>
          <p className="mt-1 text-sm text-muted-foreground">
            {soldListings.length} sale{soldListings.length === 1 ? "" : "s"}
          </p>
          <div className="mt-6">
            <RecentFeedClient
              listings={soldListings}
              favoritedListingIds={favoritedIds}
              isLoggedIn={loggedIn}
              viewerUserId={userId}
              soldPresentation
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
