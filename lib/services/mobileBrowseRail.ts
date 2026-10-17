import {
  MOBILE_LISTING_CATEGORIES,
  MOBILE_SELLER_RESOURCE_SLUGS,
  mobileBrowseRailSchema,
  type MobileBrowseRail,
  type MobileListingCategory,
  type MobileSellerResourceSlug,
} from "@reswell/api-contract"
import {
  sellerResourcesNavLinks,
  siteHeaderMobileCategoryNavLinks,
  siteHeaderMobileSecondaryNavLinks,
} from "@/lib/site-category-directory"

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

const PAGE_BY_PATH = {
  "/sellers": "sellers",
  "/sold": "sold",
} as const

const SCREEN_BY_PATH: Record<string, MobileSellerResourceSlug> = {
  "/for-surf-shops": "for-surf-shops",
  "/seller-resources/how-to-sell": "how-to-sell",
  "/seller-resources/how-to-ship": "how-to-ship",
  "/map": "sales-map",
  "/seller-resources": "seller-resources",
}

function screenForHref(href: string): MobileSellerResourceSlug | null {
  const path = href.split("?")[0]?.replace(/\/$/, "") || "/"
  const screen = SCREEN_BY_PATH[path]
  if (!screen || !MOBILE_SELLER_RESOURCE_SLUGS.includes(screen)) return null
  return screen
}

function categoryForHref(href: string): MobileListingCategory | null {
  const path = href.split("?")[0]?.replace(/\/$/, "") || "/"
  const category = CATEGORY_BY_PATH[path]
  if (!category || !MOBILE_LISTING_CATEGORIES.includes(category)) return null
  return category
}

/** Site paths only. The app opens these on the deployed website. */
function siteHref(href: string): string | null {
  const trimmed = href.trim()
  if (!trimmed.startsWith("/") || trimmed.startsWith("//")) return null
  return trimmed
}

/**
 * Same category chips and Seller Resources dropdown the website renders.
 * A web deploy changes this response, so the app picks up new pages on its next visit.
 */
export function getMobileBrowseRail(): MobileBrowseRail {
  const categories = siteHeaderMobileCategoryNavLinks.flatMap((link) => {
    const href = siteHref(link.href)
    if (!href) return []
    return [
      {
        kind: "category" as const,
        label: link.label,
        href,
        category: categoryForHref(href),
      },
    ]
  })
  const resources = sellerResourcesNavLinks.flatMap((link) => {
    const href = siteHref(link.href)
    if (!href) return []
    return [{ label: link.label, href, category: categoryForHref(href), screen: screenForHref(href) }]
  })
  const pages = siteHeaderMobileSecondaryNavLinks.flatMap((link) => {
    const href = siteHref(link.href)
    if (!href) return []
    const path = href.split("?")[0]?.replace(/\/$/, "") || "/"
    return [
      {
        kind: "page" as const,
        label: link.label,
        href,
        page: PAGE_BY_PATH[path as keyof typeof PAGE_BY_PATH] ?? null,
      },
    ]
  })
  const items = [
    ...categories,
    ...(resources.length > 0
      ? [
          {
            kind: "menu" as const,
            id: "seller-resources",
            label: "Seller Resources",
            items: resources,
          },
        ]
      : []),
    ...pages,
  ]
  return mobileBrowseRailSchema.parse({ items })
}
