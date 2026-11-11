import { canUseListingVacationMode } from "@/lib/listing-vacation-mode"

export type ShopVacationListing = {
  id: string
  status: string | null
  hidden_from_site: boolean | null
  site_visibility_reason: string | null
  archived_at?: string | null
}

export type ShopVacationMode = "on" | "off"

function isSellerVacationHide(listing: ShopVacationListing): boolean {
  if (listing.hidden_from_site !== true) return false
  return (
    listing.site_visibility_reason === "seller_vacation" ||
    listing.site_visibility_reason === "seller_inactivity"
  )
}

/**
 * Live listings a shop-wide vacation action should change.
 * Turning vacation on hides listings that are still public.
 * Turning it off restores listings the seller put on vacation, plus listings
 * the old auto-vacation job hid.
 */
export function shopVacationTargetIds(
  listings: ShopVacationListing[],
  mode: ShopVacationMode,
): string[] {
  const ids: string[] = []
  for (const listing of listings) {
    if (listing.archived_at) continue
    if (!canUseListingVacationMode(listing.status)) continue
    if (mode === "on") {
      if (listing.hidden_from_site === true) continue
      ids.push(listing.id)
      continue
    }
    if (isSellerVacationHide(listing)) ids.push(listing.id)
  }
  return ids
}

export function shopVacationButtonMode(listings: ShopVacationListing[]): ShopVacationMode | "unavailable" {
  const live = listings.filter(
    (listing) => !listing.archived_at && canUseListingVacationMode(listing.status),
  )
  if (live.length === 0) return "unavailable"
  const visible = live.filter((listing) => listing.hidden_from_site !== true)
  if (visible.length > 0) return "on"
  const sellerVacation = live.filter(isSellerVacationHide)
  if (sellerVacation.length > 0) return "off"
  return "unavailable"
}
