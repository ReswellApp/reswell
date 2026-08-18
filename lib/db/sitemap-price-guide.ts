import type { SupabaseClient } from "@supabase/supabase-js"
import {
  type PriceGuideCategorySlug,
  PRICE_GUIDE_CATEGORY_SLUGS,
  priceGuideBrandHref,
  priceGuideCategoryHref,
  priceGuideHubHref,
  priceGuideModelHref,
  priceGuideModelSlug,
} from "@/lib/price-guide/categories"

export type PriceGuideSitemapPath = { path: string }

export async function fetchPriceGuideSitemapPaths(
  supabase: SupabaseClient,
): Promise<PriceGuideSitemapPath[]> {
  const paths: PriceGuideSitemapPath[] = [{ path: priceGuideHubHref() }]
  for (const slug of PRICE_GUIDE_CATEGORY_SLUGS) {
    paths.push({ path: priceGuideCategoryHref(slug) })
  }

  const { data, error } = await supabase
    .from("price_guide_entries")
    .select(
      "category_slug, brand_id, brand_model_id, brands:brand_id ( slug ), brand_models:brand_model_id ( name )",
    )
    .eq("status", "published")
    .limit(800)

  if (error) {
    console.error("[sitemap] price guide:", error.message)
    return paths
  }

  type Joined = {
    category_slug: string
    brand_id: string | null
    brand_model_id: string | null
    brands: { slug: string } | { slug: string }[] | null
    brand_models: { name: string } | { name: string }[] | null
  }

  for (const row of (data ?? []) as Joined[]) {
    if (!(PRICE_GUIDE_CATEGORY_SLUGS as readonly string[]).includes(row.category_slug)) continue
    const category = row.category_slug as PriceGuideCategorySlug
    const brand = Array.isArray(row.brands) ? row.brands[0] ?? null : row.brands
    const model = Array.isArray(row.brand_models) ? row.brand_models[0] ?? null : row.brand_models
    if (row.brand_id && brand?.slug && row.brand_model_id && model?.name) {
      paths.push({ path: priceGuideModelHref(category, brand.slug, priceGuideModelSlug(model.name)) })
    } else if (row.brand_id && brand?.slug) {
      paths.push({ path: priceGuideBrandHref(category, brand.slug) })
    }
  }

  return paths
}
