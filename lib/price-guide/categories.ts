import {
  BRAND_PRODUCT_CATEGORY_OPTIONS,
  type BrandProductCategorySlug,
} from "@/lib/brand-product-categories"
import { slugify } from "@/lib/slugify"

export const PRICE_GUIDE_CATEGORY_SLUGS = [
  "surfboards",
  "fins",
  "wetsuits",
  "boardbags",
  "surfpacks",
  "leashes",
  "apparel",
  "accessories",
  "magazines",
] as const

export type PriceGuideCategorySlug = (typeof PRICE_GUIDE_CATEGORY_SLUGS)[number]

const LABEL_BY_SLUG: Record<PriceGuideCategorySlug, string> = {
  surfboards: "Surfboards",
  fins: "Fins",
  wetsuits: "Wetsuits",
  boardbags: "Boardbags",
  surfpacks: "Surfpacks",
  leashes: "Leashes",
  apparel: "Apparel",
  accessories: "Accessories",
  magazines: "Magazines",
}

const BLURB_BY_SLUG: Record<PriceGuideCategorySlug, string> = {
  surfboards: "Used and new board values from live Reswell listings and completed sales.",
  fins: "What thrusters, twins, and quads are actually trading for.",
  wetsuits: "Seasonal used-suit pricing by brand and thickness.",
  boardbags: "Travel and day-bag values across the used market.",
  surfpacks: "Backpack and day-pack comps from the marketplace.",
  leashes: "Typical asking and sold prices for leashes.",
  apparel: "Used surf apparel — what it lists and what it sells for.",
  accessories: "Traction, hardware, and small-goods pricing.",
  magazines: "Collector and reading-copy magazine values.",
}

const BROWSE_HREF_BY_SLUG: Record<PriceGuideCategorySlug, string> = {
  surfboards: "/boards",
  fins: "/fins",
  wetsuits: "/wetsuits",
  boardbags: "/boardbags",
  surfpacks: "/surfpacks",
  leashes: "/leashes",
  apparel: "/apparel",
  accessories: "/accessories",
  magazines: "/magazines",
}

const SELL_HREF_BY_SLUG: Record<PriceGuideCategorySlug, string> = {
  surfboards: "/sell/boards",
  fins: "/sell/fins",
  wetsuits: "/sell/wetsuits",
  boardbags: "/sell/boardbags",
  surfpacks: "/sell/surfpacks",
  leashes: "/sell/leashes",
  apparel: "/sell/apparel",
  accessories: "/sell/accessories",
  magazines: "/sell/magazines",
}

const SLUG_SET = new Set<string>(PRICE_GUIDE_CATEGORY_SLUGS)

export const PRICE_GUIDE_CATEGORY_OPTIONS: readonly {
  slug: PriceGuideCategorySlug
  label: string
}[] = PRICE_GUIDE_CATEGORY_SLUGS.map((slug) => ({
  slug,
  label: LABEL_BY_SLUG[slug],
}))

export function isPriceGuideCategorySlug(value: string): value is PriceGuideCategorySlug {
  return SLUG_SET.has(value)
}

export function priceGuideCategoryLabel(slug: PriceGuideCategorySlug): string {
  return LABEL_BY_SLUG[slug]
}

export function priceGuideCategoryBlurb(slug: PriceGuideCategorySlug): string {
  return BLURB_BY_SLUG[slug]
}

export function priceGuideBrowseHref(slug: PriceGuideCategorySlug): string {
  return BROWSE_HREF_BY_SLUG[slug]
}

export function priceGuideSellHref(slug: PriceGuideCategorySlug): string {
  return SELL_HREF_BY_SLUG[slug]
}

export function priceGuideHubHref(): string {
  return "/priceguide"
}

export function priceGuideCategoryHref(category: PriceGuideCategorySlug): string {
  return `/priceguide/${category}`
}

export function priceGuideBrandHref(
  category: PriceGuideCategorySlug,
  brandSlug: string,
): string {
  return `/priceguide/${category}/${brandSlug}`
}

export function priceGuideModelHref(
  category: PriceGuideCategorySlug,
  brandSlug: string,
  modelSlug: string,
): string {
  return `/priceguide/${category}/${brandSlug}/${modelSlug}`
}

export function priceGuideModelSlug(name: string): string {
  return slugify(name)
}

export function toBrandProductCategorySlug(
  slug: PriceGuideCategorySlug,
): BrandProductCategorySlug | null {
  return BRAND_PRODUCT_CATEGORY_OPTIONS.some((option) => option.slug === slug)
    ? (slug as BrandProductCategorySlug)
    : null
}
