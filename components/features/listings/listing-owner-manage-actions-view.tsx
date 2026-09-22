"use client"

import Link from "next/link"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EndListingButton } from "@/components/end-listing-button"
import { ListingVacationModeButton } from "@/components/features/sell/listing-vacation-mode-button"
import { canUseListingVacationMode } from "@/lib/listing-vacation-mode"
import { QuickEditListingPriceDialog } from "@/components/features/listings/quick-edit-listing-price-dialog"
import { SellerOfferToCartHolders } from "@/components/features/listings/seller-offer-to-cart-holders"
import { isPeerListingSection, peerListingEditHref } from "@/lib/peer-listing-sections"
import type { ListingEnrichmentGap } from "@/lib/sell-flow/listing-enrichment"
import { cn } from "@/lib/utils"

export interface ListingOwnerManageActionsViewProps {
  listingId: string
  section: string
  currentPriceUsd: number
  currentCompareAtPriceUsd?: number | null
  listingStatus: string
  hiddenFromSite?: boolean
  showQuickPriceEdit?: boolean
  enrichmentGaps?: ListingEnrichmentGap[]
  userId: string
  canDelete: boolean
  cartHolderCount: number
}

/** Seller controls. Session data is passed in so this can render from a cached page. */
export function ListingOwnerManageActionsView({
  listingId,
  section,
  currentPriceUsd,
  currentCompareAtPriceUsd = null,
  listingStatus,
  hiddenFromSite = false,
  showQuickPriceEdit = true,
  enrichmentGaps = [],
  userId,
  canDelete,
  cartHolderCount,
}: ListingOwnerManageActionsViewProps) {
  const isDraft = listingStatus === "draft"
  const isDelinquent = listingStatus === "delinquent"
  const isSold = listingStatus === "sold"
  const editHref = peerListingEditHref(section, listingId)
  const showEnrichment = !isDelinquent && !isDraft && enrichmentGaps.length > 0
  const canOfferToCart =
    isPeerListingSection(section) && !isDraft && !isDelinquent && !isSold && !hiddenFromSite

  return (
    <div
      className={cn(
        isSold && "hidden",
        !isSold && "border-b border-neutral-200/90 pb-4 dark:border-neutral-700/70",
      )}
    >
      <div className="flex min-w-0 flex-col items-start gap-2">
        <p className="text-[14px] text-muted-foreground">Your listing</p>
        {isDraft ? (
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            Draft — not published yet. Continue to finish and go live.
          </p>
        ) : isDelinquent ? (
          <p className="text-sm font-medium text-orange-700 dark:text-orange-400">
            Delinquent — this listing is hidden while your account is restricted.
          </p>
        ) : hiddenFromSite ? (
          <div className="w-full rounded-xl border border-amber-300/70 bg-amber-50 px-3.5 py-2.5 dark:border-amber-700/60 dark:bg-amber-950/40">
            <p className="text-sm font-medium text-amber-900 dark:text-amber-200">
              On vacation — hidden from shoppers
            </p>
            <p className="mt-0.5 text-[13px] text-amber-800/80 dark:text-amber-300/80">
              Browse, search, and checkout will not show this listing until you go live.
            </p>
          </div>
        ) : null}
        <div className="flex min-w-0 flex-wrap gap-2">
          <Button asChild className="rounded-full">
            <Link prefetch={false} href={editHref}>
              {isDraft ? "Continue listing" : "Edit listing"}
            </Link>
          </Button>
          {showQuickPriceEdit && !isDraft ? (
            <QuickEditListingPriceDialog
              listingId={listingId}
              currentPriceUsd={currentPriceUsd}
              currentCompareAtPriceUsd={currentCompareAtPriceUsd}
              triggerClassName="rounded-full border-border/60 shadow-none"
            />
          ) : null}
          {canOfferToCart && cartHolderCount > 0 ? (
            <SellerOfferToCartHolders
              listingId={listingId}
              sellerUserId={userId}
              cartHolderCount={cartHolderCount}
              listPrice={currentPriceUsd}
              triggerClassName="border-border/60 shadow-none"
            />
          ) : null}
          {canUseListingVacationMode(listingStatus) ? (
            <ListingVacationModeButton
              listingId={listingId}
              vacationMode={hiddenFromSite}
              className="rounded-full border-border/60 shadow-none"
            />
          ) : null}
          {!isDraft ? (
            <EndListingButton
              listingId={listingId}
              listingPriceUsd={currentPriceUsd}
              listingStatus={listingStatus}
              vacationMode={hiddenFromSite}
              canDelete={canDelete}
              triggerClassName="rounded-full border-border/60 shadow-none"
            />
          ) : null}
        </div>
        {showEnrichment ? (
          <div className="mt-1 w-full rounded-xl border border-listingHeart/20 bg-listingHeart/5 px-3.5 py-3">
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-foreground">
              <Sparkles className="size-3.5 text-listingHeart" aria-hidden />
              Make it sell faster
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {enrichmentGaps.map((gap) => (
                <Link
                  key={gap.id}
                  prefetch={false}
                  href={editHref}
                  className="rounded-full border border-listingHeart/30 bg-white px-3 py-1 text-xs font-medium text-listingHeart transition-colors hover:bg-listingHeart hover:text-white dark:bg-transparent"
                >
                  {gap.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}
