"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"
import { EndListingButton } from "@/components/end-listing-button"
import { QuickEditListingPriceDialog } from "@/components/features/listings/quick-edit-listing-price-dialog"
import {
  ListingVacationModeButton,
  canUseListingVacationMode,
} from "@/components/features/sell/listing-vacation-mode-button"
import { peerListingEditHref } from "@/lib/peer-listing-sections"

interface ListingOwnerManageActionsProps {
  listingId: string
  section: string
  currentPriceUsd: number
  listingStatus: string
  hiddenFromSite?: boolean
  showQuickPriceEdit?: boolean
}

/** Seller controls on the listing detail page — edit, quick price, vacation, end. */
export function ListingOwnerManageActions({
  listingId,
  section,
  currentPriceUsd,
  listingStatus,
  hiddenFromSite = false,
  showQuickPriceEdit = true,
}: ListingOwnerManageActionsProps) {
  const showVacation = canUseListingVacationMode(listingStatus)

  return (
    <div className="border-b border-neutral-200/90 pb-4 dark:border-neutral-700/70">
      <div className="flex min-w-0 flex-col items-start gap-2">
        <p className="text-[14px] text-muted-foreground">Your listing</p>
        {hiddenFromSite ? (
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            On vacation — hidden from browse and search until you go live again.
          </p>
        ) : null}
        <div className="flex min-w-0 flex-wrap gap-2">
          <Button asChild className="rounded-full">
            <Link prefetch={false} href={peerListingEditHref(section, listingId)}>
              Edit listing
            </Link>
          </Button>
          {showQuickPriceEdit ? (
            <QuickEditListingPriceDialog
              listingId={listingId}
              currentPriceUsd={currentPriceUsd}
              triggerClassName="rounded-full border-border/60 shadow-none"
            />
          ) : null}
          {showVacation ? (
            <ListingVacationModeButton
              listingId={listingId}
              vacationMode={hiddenFromSite}
              className="px-4"
            />
          ) : null}
          <EndListingButton
            listingId={listingId}
            triggerClassName="rounded-full border-border/60 shadow-none"
          />
        </div>
      </div>
    </div>
  )
}
