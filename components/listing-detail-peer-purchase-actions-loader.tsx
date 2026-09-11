import { cache } from "react"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"
import {
  fetchListingExclusiveBuyerFields,
  resolveListingExclusivePurchaseAccess,
} from "@/lib/services/listingBuyerExclusiveWindow"
import { resolveListingBuyerOpenOfferHref } from "@/lib/services/listingBuyerOpenOffer"
import {
  ListingDetailPeerPurchaseActions,
  type ListingDetailPeerPurchaseActionsProps,
} from "@/components/listing-detail-peer-purchase-actions"

const loadPeerPurchaseViewerState = cache(async (listingId: string) => {
  const { supabase, user } = await getCachedRequestSession()

  const [fields, openOfferHref] = await Promise.all([
    fetchListingExclusiveBuyerFields(supabase, listingId),
    user ? resolveListingBuyerOpenOfferHref(supabase, listingId, user.id) : Promise.resolve(null),
  ])

  const exclusivePurchaseAccess = fields
    ? resolveListingExclusivePurchaseAccess(fields, user?.id ?? null)
    : ({ kind: "open" } as const)

  return { exclusivePurchaseAccess, openOfferHref }
})

export async function ListingDetailPeerPurchaseActionsLoader(
  props: ListingDetailPeerPurchaseActionsProps,
) {
  const { exclusivePurchaseAccess, openOfferHref } = await loadPeerPurchaseViewerState(
    props.listingId,
  )

  return (
    <ListingDetailPeerPurchaseActions
      {...props}
      exclusivePurchaseAccess={exclusivePurchaseAccess}
      openOfferHref={openOfferHref}
    />
  )
}
