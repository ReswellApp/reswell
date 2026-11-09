import { canUseListingVacationMode } from "@/lib/listing-vacation-mode"

export type ShopVacationListing = {
  id: string
  status: string | null
  hidden_from_site: boolean | null
  site_visibility_reason: string | null
  archived_at?: string | null
}

export type ShopVacationMode = "on" | "off"

/**
 * Live listings a shop-wide vacation action should change.
 * Turning vacation on hides listings that are still public.
 * Turning it off only restores listings the seller put on vacation.
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
    if (
      listing.hidden_from_site === true &&
      listing.site_visibility_reason === "seller_vacation"
    ) {
      ids.push(listing.id)
    }
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
  const sellerVacation = live.filter(
    (listing) => listing.site_visibility_reason === "seller_vacation",
  )
  if (sellerVacation.length > 0) return "off"
  return "unavailable"
}
