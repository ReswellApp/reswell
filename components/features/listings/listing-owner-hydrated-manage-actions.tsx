"use client"

import { ListingOwnerManageActionsView } from "@/components/features/listings/listing-owner-manage-actions-view"
import { useListingViewer } from "@/components/features/listings/listing-viewer-provider"
import { ListingSoldOwnerNotice } from "@/components/listing-sold-detail-notice"
import type { ListingEnrichmentGap } from "@/lib/sell-flow/listing-enrichment"
import { listingViewerIsOwner } from "@/lib/listing-owner-view"

interface ListingOwnerHydratedManageActionsProps {
  listingId: string
  section: string
  currentPriceUsd: number
  currentCompareAtPriceUsd?: number | null
  listingStatus: string
  hiddenFromSite?: boolean
  showQuickPriceEdit?: boolean
  enrichmentGaps?: ListingEnrichmentGap[]
}

function soldSectionLabel(section: string): string {
  return section === "surfboards" ? "board" : "listing"
}

/**
 * Seller controls for the listing column. The server render is empty so the
 * shared `/l` document never includes "Your listing" markup.
 */
export function ListingOwnerHydratedManageActions({
  listingId,
  section,
  currentPriceUsd,
  currentCompareAtPriceUsd = null,
  listingStatus,
  hiddenFromSite = false,
  showQuickPriceEdit = true,
  enrichmentGaps = [],
}: ListingOwnerHydratedManageActionsProps) {
  const viewer = useListingViewer()
  const userId = viewer?.userId ?? null
  const isOwner = listingViewerIsOwner(userId, viewer?.sellerUserId)
  if (!isOwner || !userId) return null

  const owner = viewer?.privateChrome?.owner ?? null
  const isSold = listingStatus === "sold"

  return (
    <>
      {isSold ? (
        <ListingSoldOwnerNotice
          dashboardListingsHref="/dashboard/listings"
          sectionLabel={soldSectionLabel(section)}
          listingId={listingId}
          canRelist={owner?.canRelist ?? false}
          className="mt-5"
        />
      ) : null}
      <ListingOwnerManageActionsView
        listingId={listingId}
        section={section}
        currentPriceUsd={currentPriceUsd}
        currentCompareAtPriceUsd={currentCompareAtPriceUsd}
        listingStatus={listingStatus}
        hiddenFromSite={hiddenFromSite}
        showQuickPriceEdit={showQuickPriceEdit}
        enrichmentGaps={enrichmentGaps}
        userId={userId}
        canDelete={owner?.canDelete ?? false}
        cartHolderCount={owner?.cartHolderCount ?? 0}
      />
    </>
  )
}
