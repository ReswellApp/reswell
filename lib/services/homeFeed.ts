import {
  getCachedHomeRecentlyAddedFinsCatalog,
  getCachedHomeRecentlyAddedSurfboardsCatalog,
  getCachedHomeRecentlyListedGridCatalog,
  getCachedHomeRecentlySoldCatalog,
  getCachedHomeStableCatalog,
  getCachedHomeTrendingBrandsCatalog,
} from "@/lib/cache/home-public-catalog"
import {
  homeFeedSlot,
  visibleHomeFeedSlots,
  type HomeFeedSection,
  type HomeFeedSectionId,
} from "@/lib/services/homeFeedPlan"

export { visibleHomeFeedSlots }

export type HomeFeed = {
  sections: HomeFeedSection[]
}

async function loadSlot(id: HomeFeedSectionId): Promise<HomeFeedSection | null> {
  const slot = homeFeedSlot(id)
  if (!slot || !slot.enabled) return null

  switch (slot.id) {
    case "recently_listed": {
      const catalog = await getCachedHomeRecentlyListedGridCatalog()
      const listings = catalog.recentlyListedGrid ?? []
      if (listings.length === 0) return null
      return {
        kind: "listings",
        id: slot.id,
        title: slot.title,
        listings,
        listingIds: catalog.featuredListingIds,
        moreHref: slot.moreHref,
        moreLabel: slot.moreLabel,
      }
    }
    case "recently_added_fins": {
      const catalog = await getCachedHomeRecentlyAddedFinsCatalog()
      const listings = catalog.featuredFins ?? []
      if (listings.length === 0) return null
      return {
        kind: "listings",
        id: slot.id,
        title: slot.title,
        listings,
        listingIds: catalog.featuredListingIds,
        moreHref: slot.moreHref,
        moreLabel: slot.moreLabel,
      }
    }
    case "recently_added_surfboards": {
      const catalog = await getCachedHomeRecentlyAddedSurfboardsCatalog()
      const listings = catalog.featuredBoards ?? []
      if (listings.length === 0) return null
      return {
        kind: "listings",
        id: slot.id,
        title: slot.title,
        listings,
        listingIds: catalog.featuredListingIds,
        moreHref: slot.moreHref,
        moreLabel: slot.moreLabel,
      }
    }
    case "recently_sold": {
      const catalog = await getCachedHomeRecentlySoldCatalog()
      const listings = catalog.featuredRecentlySold ?? []
      if (listings.length === 0) return null
      return {
        kind: "listings",
        id: slot.id,
        title: slot.title,
        listings,
        listingIds: catalog.featuredListingIds,
        moreHref: slot.moreHref,
        moreLabel: slot.moreLabel,
      }
    }
    case "trending_brands": {
      const catalog = await getCachedHomeTrendingBrandsCatalog()
      return {
        kind: "brands",
        id: slot.id,
        title: slot.title,
        brands: catalog.homeTrendingBrandRows,
      }
    }
    case "featured_shops": {
      const catalog = await getCachedHomeStableCatalog()
      const shops = catalog.featuredShops ?? []
      if (shops.length === 0) return null
      return {
        kind: "shops",
        id: slot.id,
        title: slot.title,
        subtitle: slot.subtitle,
        shops,
        moreHref: slot.moreHref,
        moreLabel: slot.moreLabel,
      }
    }
    case "reswell_shop": {
      const catalog = await getCachedHomeStableCatalog()
      if (catalog.featuredNew.length === 0 || !slot.href) return null
      return {
        kind: "reswell_shop",
        id: slot.id,
        title: slot.title,
        href: slot.href,
        products: catalog.featuredNew,
        listingIds: catalog.featuredListingIds,
      }
    }
    default: {
      const unreachable: never = slot.id
      return unreachable
    }
  }
}

/** One homepage rail. Empty peer and seller rails are omitted. Brands stay so admins can curate an empty strip. */
export async function loadHomeFeedSection(id: HomeFeedSectionId): Promise<HomeFeedSection | null> {
  return loadSlot(id)
}

/**
 * Ordered homepage rails for the website and the mobile home API.
 * A failed rail is dropped so the rest of the feed still renders.
 */
export async function getHomeFeed(): Promise<HomeFeed> {
  const loaded = await Promise.all(
    visibleHomeFeedSlots().map(async (slot) => {
      try {
        return await loadSlot(slot.id)
      } catch (error) {
        console.error("[home-feed] section failed", {
          section: slot.id,
          timestamp: new Date().toISOString(),
          message: error instanceof Error ? error.message : String(error),
        })
        return null
      }
    }),
  )
  return { sections: loaded.filter((section): section is HomeFeedSection => section !== null) }
}
