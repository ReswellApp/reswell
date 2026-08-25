export const CATEGORY_TOP_SHOP_SECTIONS = ["surfboards", "fins"] as const

export type CategoryTopShopSection = (typeof CATEGORY_TOP_SHOP_SECTIONS)[number]

export type CategoryTopShop = {
  id: string
  href: string
  name: string
  locationLabel: string | null
  imageSrc: string
  imageFit: "contain" | "cover"
  avgRating: number
  reviewCount: number
  shopVerified: boolean
  /** True when this seller completed at least one shipping checkout in the category. */
  completedShipping: boolean
}
