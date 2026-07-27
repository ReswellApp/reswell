/**
 * Product categories a brand manufactures (surfboards, fins, wetsuits, …).
 * Slugs align with marketplace browse sections in `lib/site-category-directory.ts`.
 */

export const BRAND_PRODUCT_CATEGORY_SLUGS = [
  "surfboards",
  "fins",
  "wetsuits",
  "boardbags",
  "surfpacks",
  "leashes",
  "apparel",
  "accessories",
] as const

export type BrandProductCategorySlug = (typeof BRAND_PRODUCT_CATEGORY_SLUGS)[number]

export const BRAND_PRODUCT_CATEGORY_OPTIONS: readonly {
  slug: BrandProductCategorySlug
  label: string
}[] = [
  { slug: "surfboards", label: "Surfboards" },
  { slug: "fins", label: "Fins" },
  { slug: "wetsuits", label: "Wetsuits" },
  { slug: "boardbags", label: "Boardbags" },
  { slug: "surfpacks", label: "Surfpacks" },
  { slug: "leashes", label: "Leashes" },
  { slug: "apparel", label: "Apparel" },
  { slug: "accessories", label: "Accessories" },
]

/** Product types shown on `/brands` filters — expand as more catalog surfaces ship. */
export const BRANDS_DIRECTORY_FILTER_CATEGORY_SLUGS = [
  "surfboards",
  "fins",
  "wetsuits",
] as const satisfies readonly BrandProductCategorySlug[]

export type BrandsDirectoryFilterCategorySlug =
  (typeof BRANDS_DIRECTORY_FILTER_CATEGORY_SLUGS)[number]

const BRANDS_DIRECTORY_FILTER_SLUG_SET = new Set<string>(BRANDS_DIRECTORY_FILTER_CATEGORY_SLUGS)

export const BRANDS_DIRECTORY_FILTER_CATEGORY_OPTIONS: readonly {
  slug: BrandsDirectoryFilterCategorySlug
  label: string
}[] = BRAND_PRODUCT_CATEGORY_OPTIONS.filter(
  (option): option is { slug: BrandsDirectoryFilterCategorySlug; label: string } =>
    BRANDS_DIRECTORY_FILTER_SLUG_SET.has(option.slug),
)

const SLUG_SET = new Set<string>(BRAND_PRODUCT_CATEGORY_SLUGS)

const LABEL_BY_SLUG = Object.fromEntries(
  BRAND_PRODUCT_CATEGORY_OPTIONS.map((o) => [o.slug, o.label]),
) as Record<BrandProductCategorySlug, string>

export function isBrandProductCategorySlug(value: string): value is BrandProductCategorySlug {
  return SLUG_SET.has(value)
}

export function brandProductCategoryLabel(slug: BrandProductCategorySlug): string {
  return LABEL_BY_SLUG[slug]
}

/** Dedupe and preserve canonical option order. */
export function normalizeBrandProductCategorySlugs(
  slugs: readonly BrandProductCategorySlug[],
): BrandProductCategorySlug[] {
  const picked = new Set(slugs)
  return BRAND_PRODUCT_CATEGORY_SLUGS.filter((slug) => picked.has(slug))
}

export function parseBrandProductCategorySlugsFromSearchParam(
  raw: string | string[] | undefined,
): BrandProductCategorySlug[] {
  const parts: string[] = []
  if (typeof raw === "string") {
    parts.push(...raw.split(","))
  } else if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (typeof entry === "string") parts.push(...entry.split(","))
    }
  }
  const slugs = parts
    .map((s) => s.trim())
    .filter(Boolean)
    .filter(isBrandProductCategorySlug)
  return normalizeBrandProductCategorySlugs(slugs)
}

/** Parse `?category=` for `/brands`, limited to directory-visible product types. */
export function parseBrandsDirectoryFilterCategorySlugsFromSearchParam(
  raw: string | string[] | undefined,
): BrandsDirectoryFilterCategorySlug[] {
  return parseBrandProductCategorySlugsFromSearchParam(raw).filter(
    (slug): slug is BrandsDirectoryFilterCategorySlug =>
      BRANDS_DIRECTORY_FILTER_SLUG_SET.has(slug),
  )
}

export function parseBrandProductCategorySlugsFromBody(
  input: unknown,
): BrandProductCategorySlug[] | { error: string } {
  if (input === undefined) return []
  if (!Array.isArray(input)) return { error: "product_categories must be an array" }
  const slugs: BrandProductCategorySlug[] = []
  for (const item of input) {
    if (typeof item !== "string" || !isBrandProductCategorySlug(item.trim())) {
      return { error: "Invalid product category" }
    }
    slugs.push(item.trim() as BrandProductCategorySlug)
  }
  return normalizeBrandProductCategorySlugs(slugs)
}
