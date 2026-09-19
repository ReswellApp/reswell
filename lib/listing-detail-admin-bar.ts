import type { ListingAdminCartHolder } from "./types/listing-cart-holders.ts"
import { parseListingSearchTags } from "./listing-search-tags.ts"

export type { ListingAdminCartHolder }

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

export function listingAdminBarCartHoldersLabel(count: number): string {
  if (count <= 0) return "Cart"
  return count === 1 ? "1 in cart" : `${count} in cart`
}

export function listingAdminCartHolderDisplayName(input: {
  isShop?: boolean | null
  shopName?: string | null
  displayName?: string | null
  email?: string | null
}): string {
  if (input.isShop === true) {
    const shop = asTrimmedString(input.shopName)
    if (shop) return shop
  }
  return (
    asTrimmedString(input.displayName) ??
    asTrimmedString(input.email) ??
    "Member"
  )
}

export type ListingAdminCartHolderSource = {
  profileId: unknown
  quantity?: unknown
  addedAt?: unknown
  isShop?: unknown
  shopName?: unknown
  displayName?: unknown
  email?: unknown
  avatarUrl?: unknown
}

export function listingAdminCartHolderFromSource(
  row: ListingAdminCartHolderSource,
): ListingAdminCartHolder | null {
  const userId = asTrimmedString(row.profileId)
  if (!userId) return null

  const quantityRaw =
    typeof row.quantity === "number"
      ? row.quantity
      : typeof row.quantity === "string"
        ? Number(row.quantity)
        : 1
  const quantity =
    Number.isFinite(quantityRaw) && quantityRaw >= 1 ? Math.trunc(quantityRaw) : 1

  return {
    userId,
    displayName: listingAdminCartHolderDisplayName({
      isShop: row.isShop === true,
      shopName: asTrimmedString(row.shopName),
      displayName: asTrimmedString(row.displayName),
      email: asTrimmedString(row.email),
    }),
    email: asTrimmedString(row.email),
    avatarUrl: asTrimmedString(row.avatarUrl),
    quantity,
    addedAt: asTrimmedString(row.addedAt) ?? "",
  }
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
