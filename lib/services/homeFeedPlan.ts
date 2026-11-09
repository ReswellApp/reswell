import type { HomePeerScrollListing } from "@/components/features/home/home-peer-listing-scroll-tile"
import type { HomeFeaturedNewItem, HomeFeaturedShop } from "@/lib/cache/home-public-catalog"
import type { HomeTrendingBrandRow } from "@/lib/db/home-trending-brands"

/**
 * Homepage rails, in display order.
 * Turn a rail on or off, rename it, or move it here. The website and the
 * mobile home API both render this list. The website paints `recently_listed`
 * in the hero shell; every other visible slot streams underneath, in this order.
 * The app renders every visible slot in this order.
 *
 * Set `enabled` on `reswell_shop` to show "Shop From Reswell" on both.
 */
export type HomeFeedPlanItem = {
  id:
    | "recently_listed"
    | "recently_added_fins"
    | "trending_brands"
    | "recently_added_surfboards"
    | "recently_sold"
    | "featured_shops"
    | "reswell_shop"
  kind: "listings" | "brands" | "shops" | "reswell_shop"
  title: string
  enabled: boolean
  moreHref: string | null
  moreLabel: string | null
  subtitle: string | null
  href: string | null
}

export const homeFeedPlan: readonly HomeFeedPlanItem[] = [
  {
    id: "recently_listed",
    kind: "listings",
    title: "Recently listed",
    enabled: true,
    moreHref: null,
    moreLabel: null,
    subtitle: null,
    href: null,
  },
  {
    id: "recently_added_fins",
    kind: "listings",
    title: "Recently added fins",
    enabled: true,
    moreHref: "/fins",
    moreLabel: "Find More",
    subtitle: null,
    href: null,
  },
  {
    id: "trending_brands",
    kind: "brands",
    title: "Trending brands",
    enabled: true,
    moreHref: null,
    moreLabel: null,
    subtitle: null,
    href: null,
  },
  {
    id: "recently_added_surfboards",
    kind: "listings",
    title: "Recently added surfboards",
    enabled: true,
    moreHref: "/boards",
    moreLabel: "Find More",
    subtitle: null,
    href: null,
  },
  {
    id: "recently_sold",
    kind: "listings",
    title: "Recently sold surfboards",
    enabled: true,
    moreHref: "/sold",
    moreLabel: "Find More",
    subtitle: null,
    href: null,
  },
  {
    id: "featured_shops",
    kind: "shops",
    title: "Featured Sellers",
    enabled: true,
    moreHref: "/sellers",
    moreLabel: "All Sellers",
    subtitle: "Browse gear from local retail stores",
    href: null,
  },
  {
    id: "reswell_shop",
    kind: "reswell_shop",
    title: "Shop From Reswell",
    enabled: false,
    moreHref: null,
    moreLabel: null,
    subtitle: null,
    href: "/reswell/shop",
  },
]

export type HomeFeedSlot = HomeFeedPlanItem
export type HomeFeedSectionId = HomeFeedSlot["id"]

export type HomeFeedListingsSection = {
  kind: "listings"
  id: "recently_listed" | "recently_added_fins" | "recently_added_surfboards" | "recently_sold"
  title: string
  listings: HomePeerScrollListing[]
  listingIds: string[]
  moreHref: string | null
  moreLabel: string | null
}

export type HomeFeedBrandsSection = {
  kind: "brands"
  id: "trending_brands"
  title: string
  brands: HomeTrendingBrandRow[]
}

export type HomeFeedShopsSection = {
  kind: "shops"
  id: "featured_shops"
  title: string
  subtitle: string | null
  shops: HomeFeaturedShop[]
  moreHref: string | null
  moreLabel: string | null
}

export type HomeFeedReswellShopSection = {
  kind: "reswell_shop"
  id: "reswell_shop"
  title: string
  href: string
  products: HomeFeaturedNewItem[]
  listingIds: string[]
}

export type HomeFeedSection =
  | HomeFeedListingsSection
  | HomeFeedBrandsSection
  | HomeFeedShopsSection
  | HomeFeedReswellShopSection

export function visibleHomeFeedSlots(): HomeFeedSlot[] {
  return homeFeedPlan.filter((slot) => slot.enabled)
}

export function homeFeedSlot(id: HomeFeedSectionId): HomeFeedSlot | null {
  return homeFeedPlan.find((slot) => slot.id === id) ?? null
}
