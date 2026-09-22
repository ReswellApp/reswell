import type { SupabaseClient } from "@supabase/supabase-js"
import { listingIdsWithOpenMarketplaceCheckout } from "@/lib/db/listingDeleteEligibility"
import type { ListingAdminCartHolder } from "@/lib/listing-detail-admin-bar"
import { listingEligibleForSellerRelist } from "@/lib/listing-sold-state"

export type ListingPrivateChrome = {
  isAdmin: boolean
  adminHolders: ListingAdminCartHolder[]
  owner: {
    userId: string
    canDelete: boolean
    cartHolderCount: number
    canRelist: boolean
  } | null
}

export type ListingOwnerRelistRow = {
  id: string
  user_id: string
  status: string | null
  sold_off_platform: boolean | null
  archived_at: string | null
}

export async function sellerCanRelistListing(
  supabase: SupabaseClient,
  userId: string,
  listing: ListingOwnerRelistRow,
): Promise<boolean> {
  if (listing.user_id !== userId) return false
  if (
    !listingEligibleForSellerRelist({
      status: listing.status,
      sold_off_platform: listing.sold_off_platform === true,
      archived_at: listing.archived_at,
    })
  ) {
    return false
  }
  const checkoutSold = await listingIdsWithOpenMarketplaceCheckout(supabase, [listing.id])
  if (checkoutSold.error) return false
  return !checkoutSold.listingIds.has(listing.id)
}
