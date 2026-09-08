export type SellerResourceLink = { label: string; href: string }

export const SELLER_RESOURCES_HUB_HREF = "/seller-resources"
export const HOW_TO_SELL_HREF = "/seller-resources/how-to-sell"
export const HOW_TO_SHIP_HREF = "/seller-resources/how-to-ship"
export const SALES_MAP_HREF = "/map"

/**
 * Seller Resources dropdown — How to Sell, How to Ship, Sales Map, More Sell Resources.
 * Pricing Hub and Sell-Out List stay out of the nav until those pages have data.
 */
export const sellerResourcesNavLinks: SellerResourceLink[] = [
  { label: "How to Sell", href: HOW_TO_SELL_HREF },
  { label: "How to Ship", href: HOW_TO_SHIP_HREF },
  { label: "Sales Map", href: SALES_MAP_HREF },
  { label: "More Sell Resources", href: SELLER_RESOURCES_HUB_HREF },
]

export type SellerResourceComingSoon = {
  label: string
  description: string
}

export const sellerResourcesComingSoon: SellerResourceComingSoon[] = [
  {
    label: "Pricing Hub",
    description: "Comps and asking prices to help you set a number. Coming once we have more data.",
  },
  {
    label: "The Sell-Out List",
    description: "What is moving on Reswell right now. Coming once we have more data.",
  },
]

export function sellerResourcesNavItemIsActive(
  pathname: string | null,
  href: string,
): boolean {
  if (!pathname) return false
  const pathOnly = href.replace(/\/$/, "") || "/"
  const normalized = pathname.replace(/\/$/, "") || "/"
  if (pathOnly === SELLER_RESOURCES_HUB_HREF) {
    return normalized === pathOnly
  }
  return normalized === pathOnly || normalized.startsWith(`${pathOnly}/`)
}

export function sellerResourcesNavIsActive(pathname: string | null): boolean {
  if (!pathname) return false
  const normalized = pathname.replace(/\/$/, "") || "/"
  if (
    normalized === SELLER_RESOURCES_HUB_HREF ||
    normalized.startsWith(`${SELLER_RESOURCES_HUB_HREF}/`)
  ) {
    return true
  }
  return sellerResourcesNavLinks.some((link) =>
    sellerResourcesNavItemIsActive(pathname, link.href),
  )
}
