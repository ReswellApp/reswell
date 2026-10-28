import type { MobileListingCard } from "@reswell/api-contract"

export type ProfileShopSort = "newest" | "relevant" | "price_asc" | "price_desc"

export const PROFILE_SHOP_SORT_OPTIONS: { id: ProfileShopSort; label: string; pillLabel: string }[] = [
  { id: "newest", label: "Most Recent First", pillLabel: "Recent" },
  { id: "relevant", label: "Most Relevant", pillLabel: "Relevant" },
  { id: "price_asc", label: "Price: Low to High", pillLabel: "Price ↑" },
  { id: "price_desc", label: "Price: High to Low", pillLabel: "Price ↓" },
]

const SECTION_SORT_ORDER = [
  "surfboards",
  "fins",
  "wetsuits",
  "boardbags",
  "surfpacks",
  "leashes",
  "magazines",
  "traction",
  "apparel",
  "accessories",
] as const

function sectionSortRank(section: string | null | undefined): number {
  if (!section) return SECTION_SORT_ORDER.length
  const index = SECTION_SORT_ORDER.indexOf(section as (typeof SECTION_SORT_ORDER)[number])
  return index === -1 ? SECTION_SORT_ORDER.length : index
}

function listingPrice(listing: MobileListingCard): number {
  return Number.isFinite(listing.price_usd) ? listing.price_usd : 0
}

export function sortProfileShopListings(
  listings: MobileListingCard[],
  sort: ProfileShopSort,
  sectionFilter: string | null,
): MobileListingCard[] {
  // Keep paginated newest order. Section-grouping the growing window jumps the list.
  if (sort === "newest") return listings
  const result = [...listings]
  result.sort((a, b) => {
    if (!sectionFilter && sort === "relevant") {
      const sectionRank = sectionSortRank(a.section) - sectionSortRank(b.section)
      if (sectionRank !== 0) return sectionRank
    }
    if (sort === "price_asc") return listingPrice(a) - listingPrice(b)
    if (sort === "price_desc") return listingPrice(b) - listingPrice(a)
    return 0
  })
  return result
}

export function profileShopSortPillLabel(sort: ProfileShopSort): string {
  return PROFILE_SHOP_SORT_OPTIONS.find((option) => option.id === sort)?.pillLabel ?? "Recent"
}
