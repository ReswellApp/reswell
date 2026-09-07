import type { SupabaseClient } from "@supabase/supabase-js"
import {
  countBrandModelsCreatedSince,
  countBrandsCreatedSince,
  listBrandModelsCreatedSince,
  listBrandsCreatedSince,
} from "@/lib/db/brandCatalogRecent"

export type BrandCatalogRecentBrand = {
  id: string
  slug: string
  name: string
  logoUrl: string | null
  modelCount: number
  createdAt: string
}

export type BrandCatalogRecentModel = {
  id: string
  name: string
  createdAt: string
  brand: { id: string; name: string; slug: string }
}

export type BrandCatalogRecentSnapshot = {
  brandsLast24h: number
  brandsLast7d: number
  modelsLast24h: number
  modelsLast7d: number
  recentBrands: BrandCatalogRecentBrand[]
  recentModels: BrandCatalogRecentModel[]
}

const BRAND_LIST_LIMIT = 36
const MODEL_LIST_LIMIT = 48

export async function getBrandCatalogRecentSnapshot(
  supabase: SupabaseClient,
): Promise<BrandCatalogRecentSnapshot> {
  const now = Date.now()
  const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString()
  const since7d = new Date(now - 7 * 24 * 60 * 60 * 1000).toISOString()

  const [brandsLast24h, brandsLast7d, modelsLast24h, modelsLast7d, brandRows, modelRows] =
    await Promise.all([
      countBrandsCreatedSince(supabase, since24h),
      countBrandsCreatedSince(supabase, since7d),
      countBrandModelsCreatedSince(supabase, since24h),
      countBrandModelsCreatedSince(supabase, since7d),
      listBrandsCreatedSince(supabase, since7d, BRAND_LIST_LIMIT),
      listBrandModelsCreatedSince(supabase, since24h, MODEL_LIST_LIMIT),
    ])

  return {
    brandsLast24h,
    brandsLast7d,
    modelsLast24h,
    modelsLast7d,
    recentBrands: brandRows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      logoUrl: row.logo_url,
      modelCount: row.model_count,
      createdAt: row.created_at,
    })),
    recentModels: modelRows.map((row) => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      brand: row.brand,
    })),
  }
}
