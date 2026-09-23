import { cache } from "react"
import { createAnonSupabaseClient } from "@/lib/supabase/anon"
import { getCachedRequestSession } from "@/lib/auth/cached-request-session"
import { captureException } from "@/lib/services/opsIngest"
import {
  fetchListingExclusiveBuyerFields,
  resolveListingExclusivePurchaseAccess,
} from "@/lib/services/listingBuyerExclusiveWindow"
import { resolveListingBuyerOpenOfferHref } from "@/lib/services/listingBuyerOpenOffer"
import {
  ListingDetailPeerPurchaseActions,
  type ListingDetailPeerPurchaseActionsProps,
} from "@/components/listing-detail-peer-purchase-actions"

const loadPeerPurchaseViewerState = cache(async (listingId: string, anonymous: boolean) => {
  if (anonymous) {
    const supabase = createAnonSupabaseClient()
    const fields = await fetchListingExclusiveBuyerFields(supabase, listingId)
    const exclusivePurchaseAccess = fields
      ? resolveListingExclusivePurchaseAccess(fields, null)
      : ({ kind: "open" } as const)
    return { exclusivePurchaseAccess, openOfferHref: null as string | null }
  }

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

export function ListingDetailPeerPurchaseActionsFallback() {
  return (
    <div className="flex flex-col gap-[10px]" aria-hidden>
      <div className="min-h-[52px] w-full rounded-xl bg-muted/50" />
      <div className="min-h-[52px] w-full rounded-xl bg-muted/40" />
    </div>
  )
}

export async function ListingDetailPeerPurchaseActionsLoader(
  props: ListingDetailPeerPurchaseActionsProps,
) {
  try {
    const { exclusivePurchaseAccess, openOfferHref } = await loadPeerPurchaseViewerState(
      props.listingId,
      !props.isLoggedIn,
    )

    return (
      <ListingDetailPeerPurchaseActions
        {...props}
        exclusivePurchaseAccess={exclusivePurchaseAccess}
        openOfferHref={openOfferHref}
      />
    )
  } catch (error) {
    console.error("[ListingDetailPeerPurchaseActionsLoader] failed", error)
    await captureException(error, {
      boundary: "ListingDetailPeerPurchaseActionsLoader",
      listingId: props.listingId,
    })
    return (
      <ListingDetailPeerPurchaseActions
        {...props}
        exclusivePurchaseAccess={{ kind: "open" }}
        openOfferHref={null}
      />
    )
  }
}
