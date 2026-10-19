import {
  MOBILE_BROWSE_PAGES,
  MOBILE_LISTING_CATEGORIES,
  MOBILE_SELLER_RESOURCE_SLUGS,
  mobileBrowseRailSchema,
  type MobileBrowseRail,
  type MobileListingCategory,
  type MobileSellerResourceSlug,
} from "@reswell/api-contract"
import { sellerResourcesNavLinks } from "@/lib/seller-resources"
import {
  siteHeaderMobileCategoryNavLinks,
  siteHeaderMobileSecondaryNavLinks,
} from "@/lib/site-category-directory"
import type { MobileApiResult } from "@/lib/services/mobileApi"

const CATEGORY_BY_PATH: Record<string, MobileListingCategory> = {
  "/boards": "surfboards",
  "/fins": "fins",
  "/traction": "traction",
  "/wetsuits": "wetsuits",
  "/apparel": "apparel",
  "/magazines": "magazines",
  "/boardbags": "boardbags",
  "/surfpacks": "surfpacks",
  "/leashes": "leashes",
  "/accessories": "accessories",
}

const SCREEN_BY_PATH: Record<string, MobileSellerResourceSlug> = {
  "/for-surf-shops": "for-surf-shops",
  "/seller-resources/how-to-sell": "how-to-sell",
  "/seller-resources/how-to-ship": "how-to-ship",
  "/map": "sales-map",
  "/seller-resources": "seller-resources",
}

function pathOf(href: string): string {
  const path = href.split("?")[0] ?? href
  return path.replace(/\/$/, "") || "/"
}

function categoryFor(href: string): MobileListingCategory | null {
  const category = CATEGORY_BY_PATH[pathOf(href)]
  return category && MOBILE_LISTING_CATEGORIES.includes(category) ? category : null
}

function screenFor(href: string): MobileSellerResourceSlug | null {
  const screen = SCREEN_BY_PATH[pathOf(href)]
  return screen && MOBILE_SELLER_RESOURCE_SLUGS.includes(screen) ? screen : null
}

function pageFor(href: string): (typeof MOBILE_BROWSE_PAGES)[number] | null {
  const path = pathOf(href)
  if (path === "/sellers") return "sellers"
  if (path === "/sold") return "sold"
  return null
}

/**
 * Homepage category strip. Labels and order come from the website header rail,
 * including Seller Resources, Sellers, and Sold.
 */
export function getMobileBrowseRail(): MobileBrowseRail {
  const categories = siteHeaderMobileCategoryNavLinks.map((link) => ({
    kind: "category" as const,
    label: link.label,
    href: link.href,
    category: categoryFor(link.href),
  }))
  const resources = sellerResourcesNavLinks.map((link) => ({
    label: link.label,
    href: link.href,
    category: null,
    screen: screenFor(link.href),
  }))
  const pages = siteHeaderMobileSecondaryNavLinks.map((link) => ({
    kind: "page" as const,
    label: link.label,
    href: link.href,
    page: pageFor(link.href),
  }))

  const parsed = mobileBrowseRailSchema.safeParse({
    items: [
      ...categories,
      {
        kind: "menu",
        id: "seller-resources",
        label: "Seller Resources",
        items: resources,
      },
      ...pages,
    ],
  })
  if (!parsed.success) {
    throw new Error("Unable to load categories right now")
  }
  return parsed.data
}

export function getMobileBrowseRailService(): MobileApiResult<MobileBrowseRail> {
  try {
    return { ok: true, data: getMobileBrowseRail() }
  } catch {
    return { ok: false, status: 500, error: "Unable to load categories right now" }
  }
}
