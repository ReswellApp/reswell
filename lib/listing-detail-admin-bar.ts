import { parseListingSearchTags } from "./listing-search-tags.ts"

export type ListingAdminBarSnapshot = {
  id: string
  slug: string | null
  title: string
  section: string
  status: string
  hiddenFromSite: boolean
  hiddenFromHomepage: boolean
  suppressedOnBoardsBrowse: boolean
  isGoodDeal: boolean
  searchTags: string[]
  userId: string
  sellerDisplayName: string | null
  brandId: string | null
  brandModelId: string | null
  brandLabel: string | null
  modelLabel: string | null
}

export function listingAdminBarCanSearchTag(section: string): boolean {
  return section === "surfboards"
}

function asTrimmedString(value: unknown): string | null {
  if (typeof value !== "string") return null
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

function sellerDisplayNameFromProfiles(profiles: unknown): string | null {
  if (!profiles || typeof profiles !== "object" || Array.isArray(profiles)) return null
  const row = profiles as Record<string, unknown>
  return asTrimmedString(row.shop_name) ?? asTrimmedString(row.display_name)
}

export function listingAdminBarShouldMount(input: {
  anonymousPublicView: boolean
  isAdmin: boolean
}): boolean {
  return !input.anonymousPublicView && input.isAdmin
}

export function listingAdminBarCanLinkCatalog(section: string): boolean {
  return section === "surfboards" || section === "fins"
}

export function listingAdminBarSnapshotFromRow(
  listing: Record<string, unknown>,
): ListingAdminBarSnapshot | null {
  const id = asTrimmedString(listing.id)
  const section = asTrimmedString(listing.section)
  const userId = asTrimmedString(listing.user_id)
  if (!id || !section || !userId) return null

  return {
    id,
    slug: asTrimmedString(listing.slug),
    title: asTrimmedString(listing.title) ?? "Untitled listing",
    section,
    status: asTrimmedString(listing.status) ?? "unknown",
    hiddenFromSite: listing.hidden_from_site === true,
    hiddenFromHomepage: listing.hidden_from_homepage === true,
    suppressedOnBoardsBrowse: listing.suppressed_on_boards_browse === true,
    isGoodDeal: listing.is_good_deal === true,
    searchTags: parseListingSearchTags(listing.search_tags),
    userId,
    sellerDisplayName: sellerDisplayNameFromProfiles(listing.profiles),
    brandId: asTrimmedString(listing.brand_id),
    brandModelId: asTrimmedString(listing.brand_model_id),
    brandLabel: asTrimmedString(listing.brand),
    modelLabel: asTrimmedString(listing.model),
  }
}
