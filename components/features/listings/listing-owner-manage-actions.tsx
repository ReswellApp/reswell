import Link from "next/link"
import { Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { EndListingButton } from "@/components/end-listing-button"
import { QuickEditListingPriceDialog } from "@/components/features/listings/quick-edit-listing-price-dialog"
import { SellerOfferToCartHolders } from "@/components/features/listings/seller-offer-to-cart-holders"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"
import { listingCanBePermanentlyDeleted } from "@/lib/db/listingDeleteEligibility"
import { getListingCartHolderCount } from "@/lib/db/listing-cart-holders"
import { isPeerListingSection, peerListingEditHref } from "@/lib/peer-listing-sections"
import type { ListingEnrichmentGap } from "@/lib/sell-flow/listing-enrichment"

interface ListingOwnerManageActionsProps {
  listingId: string
  section: string
  currentPriceUsd: number
  currentCompareAtPriceUsd?: number | null
  listingStatus: string
  hiddenFromSite?: boolean
  showQuickPriceEdit?: boolean
  /** "Make it sell faster" quick wins — each links to the edit form. */
  enrichmentGaps?: ListingEnrichmentGap[]
}

/** Seller controls on the listing detail page — edit, quick price, end. */
export async function ListingOwnerManageActions({
  listingId,
  section,
  currentPriceUsd,
  currentCompareAtPriceUsd = null,
  listingStatus,
  hiddenFromSite = false,
  showQuickPriceEdit = true,
  enrichmentGaps = [],
}: ListingOwnerManageActionsProps) {
  const isDraft = listingStatus === "draft"
  const isDelinquent = listingStatus === "delinquent"
  const isSold = listingStatus === "sold"
  const editHref = peerListingEditHref(section, listingId)
  const showEnrichment = !isDelinquent && !isDraft && enrichmentGaps.length > 0
  const { supabase, user } = await getCachedRequestSession()
  const canOfferToCart =
    !!user &&
    isPeerListingSection(section) &&
    !isDraft &&
    !isDelinquent &&
    !isSold &&
    !hiddenFromSite

  const [canDelete, cartHolderCount] = await Promise.all([
    isDraft ? Promise.resolve(false) : listingCanBePermanentlyDeleted(supabase, listingId),
    canOfferToCart ? getListingCartHolderCount(supabase, listingId) : Promise.resolve(0),
  ])

  return (
    <div className="border-b border-neutral-200/90 pb-4 dark:border-neutral-700/70">
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
          <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
            On vacation — hidden from browse and search. Use End listing to go live again.
          </p>
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
          {canOfferToCart && user && cartHolderCount > 0 ? (
            <SellerOfferToCartHolders
              listingId={listingId}
              sellerUserId={user.id}
              cartHolderCount={cartHolderCount}
              listPrice={currentPriceUsd}
              triggerClassName="border-border/60 shadow-none"
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
