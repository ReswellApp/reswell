import { createClient } from "@/lib/supabase/server"
import {
  fetchListingExclusiveBuyerFields,
  resolveListingExclusivePurchaseAccess,
} from "@/lib/services/listingBuyerExclusiveWindow"
import {
  ListingDetailPeerPurchaseActions,
  type ListingDetailPeerPurchaseActionsProps,
} from "@/components/listing-detail-peer-purchase-actions"

export async function ListingDetailPeerPurchaseActionsLoader(
  props: ListingDetailPeerPurchaseActionsProps,
) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const fields = await fetchListingExclusiveBuyerFields(supabase, props.listingId)
  const exclusivePurchaseAccess = fields
    ? resolveListingExclusivePurchaseAccess(fields, user?.id ?? null)
    : ({ kind: "open" } as const)

  return (
    <ListingDetailPeerPurchaseActions
      {...props}
      exclusivePurchaseAccess={exclusivePurchaseAccess}
    />
  )
}
