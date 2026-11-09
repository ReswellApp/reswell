import type { SupabaseClient } from "@supabase/supabase-js"
import { getBrandById } from "@/lib/brands/server"
import { listBrandModelsForPublicCatalogByBrandId } from "@/lib/db/brand-models"
import { matchCatalogModelForListingPage } from "@/lib/models/match"
import { modelPageSlug } from "@/lib/models/routes"

export async function resolveListingCatalogSlugs(
  supabase: SupabaseClient,
  input: { brandId: string | null; brandName: string | null; modelName: string | null },
): Promise<{ brandSlug: string | null; modelSlug: string | null }> {
  const brandName = input.brandName?.trim() ?? ""
  let brand: { id: string; slug: string } | null = null

  if (input.brandId?.trim()) {
    const found = await getBrandById(supabase, input.brandId.trim())
    if (found) brand = { id: found.id, slug: found.slug }
  }

  if (!brand && brandName) {
    const { data, error } = await supabase
      .from("brands")
      .select("id, slug")
      .ilike("name", brandName)
      .limit(1)
      .maybeSingle()
    if (!error && data?.id && data.slug) brand = { id: data.id, slug: data.slug }
  }

  if (!brand) return { brandSlug: null, modelSlug: null }

  const modelName = input.modelName?.trim() ?? ""
  if (!modelName) return { brandSlug: brand.slug, modelSlug: null }

  const models = await listBrandModelsForPublicCatalogByBrandId(supabase, brand.id)
  const match = matchCatalogModelForListingPage(models, modelName)
  return {
    brandSlug: brand.slug,
    modelSlug: match ? modelPageSlug(match.name) : null,
  }
}
