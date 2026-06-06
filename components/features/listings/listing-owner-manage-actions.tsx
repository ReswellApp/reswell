import Link from "next/link"
import { Button } from "@/components/ui/button"
import { EndListingButton } from "@/components/end-listing-button"
import { QuickEditListingPriceDialog } from "@/components/features/listings/quick-edit-listing-price-dialog"
import { peerListingEditHref } from "@/lib/peer-listing-sections"

interface ListingOwnerManageActionsProps {
  listingId: string
  section: string
  currentPriceUsd: number
  showQuickPriceEdit?: boolean
}

/** Seller controls on the listing detail page — edit, quick price, end. */
export function ListingOwnerManageActions({
  listingId,
  section,
  currentPriceUsd,
  showQuickPriceEdit = true,
}: ListingOwnerManageActionsProps) {
  return (
    <div className="border-b border-neutral-200/90 pb-4 dark:border-neutral-700/70">
      <div className="flex min-w-0 flex-col items-start gap-2">
        <p className="text-[14px] text-muted-foreground">Your listing</p>
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
          <EndListingButton
            listingId={listingId}
            triggerClassName="rounded-full border-border/60 shadow-none"
          />
        </div>
      </div>
    </div>
  )
}
