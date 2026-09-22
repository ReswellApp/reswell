import Link from "next/link"
import { Button } from "@/components/ui/button"
import { EndListingButton } from "@/components/end-listing-button"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"
import { captureException } from "@/lib/services/opsIngest"
import { listingCanBePermanentlyDeleted } from "@/lib/db/listingDeleteEligibility"
import { getListingCartHolderCount } from "@/lib/db/listing-cart-holders"
import { isPeerListingSection, peerListingEditHref } from "@/lib/peer-listing-sections"
import type { ListingEnrichmentGap } from "@/lib/sell-flow/listing-enrichment"
import { ListingOwnerManageActionsView } from "@/components/features/listings/listing-owner-manage-actions-view"

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
export async function ListingOwnerManageActions(props: ListingOwnerManageActionsProps) {
  try {
    return await renderListingOwnerManageActions(props)
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "digest" in error &&
      typeof (error as { digest?: unknown }).digest === "string" &&
      String((error as { digest: string }).digest).startsWith("NEXT_")
    ) {
      throw error
    }
    console.error("[ListingOwnerManageActions] failed", error)
    await captureException(error, {
      boundary: "ListingOwnerManageActions",
      listingId: props.listingId,
    })
    const editHref = peerListingEditHref(props.section, props.listingId)
    return (
      <div className="border-b border-neutral-200/90 pb-4 dark:border-neutral-700/70">
        <p className="text-[14px] text-muted-foreground">Your listing</p>
        <div className="mt-2 flex min-w-0 flex-wrap gap-2">
          <Button asChild className="rounded-full">
            <Link prefetch={false} href={editHref}>
              Edit listing
            </Link>
          </Button>
          {props.listingStatus !== "draft" ? (
            <EndListingButton
              listingId={props.listingId}
              listingPriceUsd={props.currentPriceUsd}
              listingStatus={props.listingStatus}
              vacationMode={props.hiddenFromSite === true}
              triggerClassName="rounded-full border-border/60 shadow-none"
            />
          ) : null}
        </div>
      </div>
    )
  }
}

async function renderListingOwnerManageActions({
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

  if (!user) return null

  return (
    <ListingOwnerManageActionsView
      listingId={listingId}
      section={section}
      currentPriceUsd={currentPriceUsd}
      currentCompareAtPriceUsd={currentCompareAtPriceUsd}
      listingStatus={listingStatus}
      hiddenFromSite={hiddenFromSite}
      showQuickPriceEdit={showQuickPriceEdit}
      enrichmentGaps={enrichmentGaps}
      userId={user.id}
      canDelete={canDelete}
      cartHolderCount={cartHolderCount}
    />
  )
}
