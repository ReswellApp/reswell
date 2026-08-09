import type { SupabaseClient } from "@supabase/supabase-js"
import type { BrandProductCategorySlug } from "@/lib/brand-product-categories"
import type { SurfboardSellCategoryKey } from "@/lib/surfboard-sell-categories"
import {
  deleteBrandModel,
  insertBrandModel,
  listBrandModelsForAdmin,
  updateBrandModel,
  type BrandModelAdminRow,
  type BrandModelRow,
} from "@/lib/db/brand-models"
import {
  deleteFinCatalogDocument,
  syncFinCatalogModelToIndex,
} from "@/lib/elasticsearch/fin-catalog-index"
import {
  deleteSellCatalogDocument,
  syncSellCatalogModelToIndex,
} from "@/lib/elasticsearch/sell-catalog-index"

export type { BrandModelAdminRow, BrandModelRow }

export async function listBrandModelsAdminService(
  supabase: SupabaseClient,
  brandId?: string,
): Promise<{ ok: true; rows: BrandModelAdminRow[] } | { ok: false; error: string }> {
  try {
    const rows = await listBrandModelsForAdmin(supabase, brandId)
    return { ok: true, rows }
  } catch {
    return { ok: false, error: "Could not load models" }
  }
}

export async function createBrandModelService(
  supabase: SupabaseClient,
  input: {
    brand_id: string
    name: string
    description: string | null
    image_url: string | null
    product_category_slug?: BrandProductCategorySlug
    board_category_slug?: SurfboardSellCategoryKey | null
  },
): Promise<{ ok: true; row: BrandModelRow } | { ok: false; error: string; status?: number }> {
  const { data: brand, error: brandErr } = await supabase.from("brands").select("id").eq("id", input.brand_id).maybeSingle()

  if (brandErr) {
    console.error("createBrandModelService (brand lookup):", brandErr.message)
    return { ok: false, error: "Could not verify brand", status: 500 }
  }
  if (!brand) {
    return { ok: false, error: "Brand not found", status: 404 }
  }

  const result = await insertBrandModel(supabase, input)
  if (!result.ok) {
    const status = result.code === "23505" ? 409 : result.code === "23503" ? 404 : 500
    return { ok: false, error: result.error, status }
  }
  void syncFinCatalogModelToIndex(supabase, result.row.id)
  void syncSellCatalogModelToIndex(supabase, result.row.id)
  return { ok: true, row: result.row }
}

export async function updateBrandModelService(
  supabase: SupabaseClient,
  id: string,
  patch: {
    name?: string
    description?: string | null
    brand_id?: string
    image_url?: string | null
    product_category_slug?: BrandProductCategorySlug
    board_category_slug?: SurfboardSellCategoryKey | null
  },
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  if (patch.brand_id) {
    const { data: brand, error: brandErr } = await supabase.from("brands").select("id").eq("id", patch.brand_id).maybeSingle()
    if (brandErr) {
      console.error("updateBrandModelService (brand lookup):", brandErr.message)
      return { ok: false, error: "Could not verify brand", status: 500 }
    }
    if (!brand) {
      return { ok: false, error: "Brand not found", status: 404 }
    }
  }

  const result = await updateBrandModel(supabase, id, patch)
  if (!result.ok) {
    const status = result.code === "23505" ? 409 : result.code === "23503" ? 404 : 500
    return { ok: false, error: result.error, status }
  }
  void syncFinCatalogModelToIndex(supabase, id)
  void syncSellCatalogModelToIndex(supabase, id)
  return { ok: true }
}

export async function deleteBrandModelService(
  supabase: SupabaseClient,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const result = await deleteBrandModel(supabase, id)
  if (!result.ok) {
    const isNotFound = /not found/i.test(result.error)
    return { ok: false, error: result.error, status: isNotFound ? 404 : 500 }
  }
  void deleteFinCatalogDocument("model", id)
  void deleteSellCatalogDocument("model", id)
  return { ok: true }
}
