import type { SupabaseClient } from "@supabase/supabase-js"
import type { BrandRow } from "@/lib/brands/types"
import { listBrands } from "@/lib/brands/server"
import type { BrandModelAdminRow } from "@/lib/db/brand-models"
import { listBrandModelsForAdmin } from "@/lib/db/brand-models"
import type { BrandModelVariantRow } from "@/lib/db/brand-model-variants"
import { listAllBrandModelVariantsForOverview } from "@/lib/db/brand-model-variants"

export type BrandCatalogModelNode = {
  model: BrandModelAdminRow
  variants: BrandModelVariantRow[]
}

export type BrandCatalogBrandNode = {
  brand: BrandRow
  models: BrandCatalogModelNode[]
}

/** Hierarchical snapshot: brands → brand_models → brand_model_variants (read-only, paged past PostgREST's 1000-row cap). */
export async function getBrandCatalogOverview(
  supabase: SupabaseClient,
): Promise<{
  stats: { brands: number; models: number; variants: number }
  nodes: BrandCatalogBrandNode[]
}> {
  const [brands, modelsAll, variantsAll] = await Promise.all([
    listBrands(supabase),
    listBrandModelsForAdmin(supabase),
    listAllBrandModelVariantsForOverview(supabase),
  ])

  const variantsByModel = new Map<string, BrandModelVariantRow[]>()
  for (const v of variantsAll) {
    const list = variantsByModel.get(v.brand_model_id) ?? []
    list.push(v)
    variantsByModel.set(v.brand_model_id, list)
  }

  const modelsByBrand = new Map<string, BrandModelAdminRow[]>()
  for (const m of modelsAll) {
    const list = modelsByBrand.get(m.brand_id) ?? []
    list.push(m)
    modelsByBrand.set(m.brand_id, list)
  }
  for (const list of modelsByBrand.values()) {
    list.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }))
  }

  const nodes: BrandCatalogBrandNode[] = brands.map((brand) => ({
    brand,
    models: (modelsByBrand.get(brand.id) ?? []).map((model) => ({
      model,
      variants: variantsByModel.get(model.id) ?? [],
    })),
  }))

  return {
    stats: {
      brands: brands.length,
      models: modelsAll.length,
      variants: variantsAll.length,
    },
    nodes,
  }
}
