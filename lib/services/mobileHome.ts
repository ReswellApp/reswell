import {
  mobileHomeSchema,
  type MobileHome,
  type MobileHomeSection,
} from "@reswell/api-contract"
import {
  getCachedHomeRecentlyAddedFinsCatalog,
  getCachedHomeRecentlyAddedSurfboardsCatalog,
  getCachedHomeRecentlyListedGridCatalog,
  getCachedHomeRecentlySoldCatalog,
  getCachedHomeStableCatalog,
  getCachedHomeTrendingBrandsCatalog,
} from "@/lib/cache/home-public-catalog"
import {
  homeBrandToMobile,
  homeListingsSection,
  homeShopProductToMobileCard,
  homeShopToMobile,
  type HomePeerCardSource,
} from "@/lib/services/mobileHomeMap"
import type { MobileApiResult } from "@/lib/services/mobileApi"

async function loadSection<T>(label: string, load: () => Promise<T>): Promise<T | null> {
  try {
    return await load()
  } catch (error) {
    console.error("[mobile-api] home section failed", {
      section: label,
      timestamp: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
    })
    return null
  }
}

function listings(
  id: Extract<MobileHomeSection, { kind: "listings" }>["id"],
  title: string,
  rows: HomePeerCardSource[] | null | undefined,
): MobileHomeSection | null {
  return homeListingsSection(id, title, rows)
}

/**
 * Same homepage catalogs the website renders, in the same order.
 * Search and shape filters stay on `GET /listings`.
 */
export async function getMobileHomeService(): Promise<MobileApiResult<MobileHome>> {
  const [grid, fins, brands, boards, sold, stable] = await Promise.all([
    loadSection("recently_listed", () => getCachedHomeRecentlyListedGridCatalog()),
    loadSection("recently_added_fins", () => getCachedHomeRecentlyAddedFinsCatalog()),
    loadSection("trending_brands", () => getCachedHomeTrendingBrandsCatalog()),
    loadSection("recently_added_surfboards", () => getCachedHomeRecentlyAddedSurfboardsCatalog()),
    loadSection("recently_sold", () => getCachedHomeRecentlySoldCatalog()),
    loadSection("stable", () => getCachedHomeStableCatalog()),
  ])

  const shopProducts = (stable?.featuredNew ?? []).flatMap((item) => {
    const card = homeShopProductToMobileCard(item.listing)
    return card ? [card] : []
  })
  const shops = (stable?.featuredShops ?? []).flatMap((shop) => {
    const mapped = homeShopToMobile(shop)
    return mapped ? [mapped] : []
  })
  const brandRows = (brands?.homeTrendingBrandRows ?? []).flatMap((row) => {
    const mapped = homeBrandToMobile(row.brand)
    return mapped ? [mapped] : []
  })

  const sections = [
    listings("recently_listed", "Recently listed", grid?.recentlyListedGrid),
    listings("recently_added_fins", "Recently added fins", fins?.featuredFins),
    brandRows.length > 0
      ? ({ kind: "brands", id: "trending_brands", title: "Trending brands", brands: brandRows } satisfies MobileHomeSection)
      : null,
    listings("recently_added_surfboards", "Recently added surfboards", boards?.featuredBoards),
    listings("recently_sold", "Recently sold surfboards", sold?.featuredRecentlySold),
    shops.length > 0
      ? ({ kind: "shops", id: "featured_shops", title: "Featured sellers", shops } satisfies MobileHomeSection)
      : null,
    shopProducts.length > 0
      ? ({ kind: "listings", id: "reswell_shop", title: "Shop From Reswell", listings: shopProducts } satisfies MobileHomeSection)
      : null,
  ].flatMap((section) => (section ? [section] : []))

  const parsed = mobileHomeSchema.safeParse({ sections })
  if (!parsed.success) {
    console.error("[mobile-api] home shape failed", {
      timestamp: new Date().toISOString(),
      issues: parsed.error.issues.map((issue) => issue.path.join(".")),
    })
    return { ok: false, status: 500, error: "Unable to load the homepage right now" }
  }
  if (parsed.data.sections.length === 0) {
    return { ok: false, status: 500, error: "Unable to load the homepage right now" }
  }
  return { ok: true, data: parsed.data }
}
