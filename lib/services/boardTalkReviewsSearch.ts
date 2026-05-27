import type { SupabaseClient } from "@supabase/supabase-js"
import { getBrandBySlug } from "@/lib/brands/server"
import {
  listBrandModelsWithBrandsForBrandIds,
  searchBrandModelsForBrandId,
  searchBrandModelsWithBrandsForSuggest,
} from "@/lib/db/brand-models"
import { searchBrandsCatalogSuggestWithClient } from "@/lib/services/brandDirectorySearch"
import { slugify } from "@/lib/slugify"

export type BoardTalkReviewsBrandSuggestRow = {
  id: string
  name: string
  slug: string
}

export type BoardTalkReviewsModelSuggestRow = {
  id: string
  name: string
  brandName: string
  brandSlug: string
  modelSlug: string
}

export type BoardTalkReviewsSearchSuggestResult = {
  brands: BoardTalkReviewsBrandSuggestRow[]
  models: BoardTalkReviewsModelSuggestRow[]
}

export async function searchBoardTalkReviewsCatalogSuggest(
  supabase: SupabaseClient,
  qRaw: string,
): Promise<BoardTalkReviewsSearchSuggestResult> {
  const q = qRaw.trim()
  if (q.length < 1) {
    return { brands: [], models: [] }
  }

  const [brandRes, modelsByName] = await Promise.all([
    searchBrandsCatalogSuggestWithClient(supabase, q),
    searchBrandModelsWithBrandsForSuggest(supabase, q, 15),
  ])

  const brandIds = brandRes.rows.map((row) => row.id)
  const modelsForMatchedBrands =
    brandIds.length > 0
      ? await listBrandModelsWithBrandsForBrandIds(supabase, brandIds, 15)
      : []

  const modelById = new Map<string, (typeof modelsByName)[number]>()
  for (const row of [...modelsByName, ...modelsForMatchedBrands]) {
    modelById.set(row.id, row)
  }
  const mergedModels = [...modelById.values()].slice(0, 15)

  return {
    brands: brandRes.rows.map((row) => ({
      id: row.id,
      name: row.name,
      slug: row.slug,
    })),
    models: mergedModels.map((row) => ({
      id: row.id,
      name: row.name,
      brandName: row.brandName,
      brandSlug: row.brandSlug,
      modelSlug: slugify(row.name),
    })),
  }
}

export async function searchBoardTalkReviewBrandsSuggest(
  supabase: SupabaseClient,
  qRaw: string,
): Promise<BoardTalkReviewsBrandSuggestRow[]> {
  const q = qRaw.trim()
  if (q.length < 1) return []

  const brandRes = await searchBrandsCatalogSuggestWithClient(supabase, q)
  return brandRes.rows.map((row) => ({
    id: row.id,
    name: row.name,
    slug: row.slug,
  }))
}

export async function searchBoardTalkReviewModelsForBrand(
  supabase: SupabaseClient,
  brandSlugRaw: string,
  qRaw: string,
): Promise<BoardTalkReviewsModelSuggestRow[]> {
  const brandSlug = brandSlugRaw.trim()
  if (!brandSlug) return []

  const brand = await getBrandBySlug(supabase, brandSlug)
  if (!brand) return []

  const models = await searchBrandModelsForBrandId(supabase, brand.id, qRaw, 15)
  return models.map((row) => ({
    id: row.id,
    name: row.name,
    brandName: brand.name,
    brandSlug: brand.slug,
    modelSlug: slugify(row.name),
  }))
}
