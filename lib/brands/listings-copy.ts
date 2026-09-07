import {
  brandProductCategoryLabel,
  type BrandProductCategorySlug,
} from "@/lib/brand-product-categories"

function productNoun(categories: readonly BrandProductCategorySlug[]): string | null {
  if (categories.includes("surfboards")) return "surfboards"
  const primary = categories[0]
  return primary ? brandProductCategoryLabel(primary).toLowerCase() : null
}

/** Live listing grid heading on `/brands/[slug]`. */
export function brandLiveListingsHeading(
  brandName: string,
  categories: readonly BrandProductCategorySlug[] = [],
): string {
  const name = brandName.trim()
  if (!name) return "For sale"
  const noun = productNoun(categories)
  return noun ? `${name} ${noun} for sale` : `${name} for sale`
}

/** Sold listing grid heading on `/brands/[slug]`. */
export function brandRecentlySoldHeading(
  brandName: string,
  categories: readonly BrandProductCategorySlug[] = [],
): string {
  const name = brandName.trim()
  if (!name) return "Recently sold"
  const noun = productNoun(categories)
  return noun ? `Recently sold ${name} ${noun}` : `Recently sold ${name}`
}
