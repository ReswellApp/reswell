import type { SupabaseClient } from "@supabase/supabase-js"
import { FIN_CATALOG_PRODUCT_CATEGORY } from "@/lib/brand-catalog-fin-variants"
import type { BrandProductCategorySlug } from "@/lib/brand-product-categories"
import { listBrandIdsMatchingProductCategories } from "@/lib/db/brand-product-categories"
import {
  BRAND_MODEL_VARIANT_DEFAULT_FIN_BOXES,
  BRAND_MODEL_VARIANT_DEFAULT_MATERIAL,
} from "@/lib/validations/brand-model-variants"
import {
  deleteBrandModelVariant,
  insertBrandModelVariant,
  listBrandModelVariantsForAdmin,
  maxSortOrderForBrandModel,
  updateBrandModelVariant,
  type BrandModelVariantRow,
  type FinBoxType,
  type FinBoxesType,
} from "@/lib/db/brand-model-variants"
import type { BrandModelVariantCondition, BrandModelVariantMaterial, FinCatalogVariantSize } from "@/lib/validations/brand-model-variants"

export type { BrandModelVariantRow, FinBoxType, FinBoxesType, BrandModelVariantCondition, BrandModelVariantMaterial }

export async function listBrandModelVariantsAdminService(
  supabase: SupabaseClient,
  brandModelId: string,
): Promise<{ ok: true; rows: BrandModelVariantRow[] } | { ok: false; error: string }> {
  try {
    const rows = await listBrandModelVariantsForAdmin(supabase, brandModelId)
    return { ok: true, rows }
  } catch {
    return { ok: false, error: "Could not load variants" }
  }
}

export async function createBrandModelVariantService(
  supabase: SupabaseClient,
  input: {
    brand_model_id: string
    brand_id: string
    length_label: string
    width_label: string
    thickness_label: string
    volume_label: string
    fin_box_type: FinBoxType
    fin_boxes?: FinBoxesType
    material?: BrandModelVariantMaterial
    condition: BrandModelVariantCondition
    fin_size?: FinCatalogVariantSize | null
    configuration_label?: string
    fin_base_label?: string
    fin_height_label?: string
    fin_foil_label?: string
    fin_color_label?: string
    product_category_slug?: BrandProductCategorySlug
    price?: number | null
    image_url: string | null
    sort_order?: number
  },
): Promise<{ ok: true; row: BrandModelVariantRow } | { ok: false; error: string; status?: number }> {
  const { data: model, error: modelErr } = await supabase
    .from("brand_models")
    .select("id, brand_id, product_category_slug")
    .eq("id", input.brand_model_id)
    .maybeSingle()

  if (modelErr) {
    console.error("createBrandModelVariantService (model lookup):", modelErr.message)
    return { ok: false, error: "Could not verify model", status: 500 }
  }
  if (!model) {
    return { ok: false, error: "Model not found", status: 404 }
  }
  if (model.brand_id !== input.brand_id) {
    return { ok: false, error: "Brand does not match this model", status: 400 }
  }

  const productCategorySlug =
    input.product_category_slug ??
    (model.product_category_slug as BrandProductCategorySlug | null) ??
    "surfboards"

  if (productCategorySlug === FIN_CATALOG_PRODUCT_CATEGORY) {
    const finBrandIds = await listBrandIdsMatchingProductCategories(supabase, [
      FIN_CATALOG_PRODUCT_CATEGORY,
    ])
    if (!finBrandIds?.includes(input.brand_id)) {
      return {
        ok: false,
        error: "Brand must be tagged with the Fins product category",
        status: 400,
      }
    }
  }

  let sortOrder = input.sort_order
  if (sortOrder === undefined) {
    const max = await maxSortOrderForBrandModel(supabase, input.brand_model_id)
    sortOrder = max + 1
  }

  const result = await insertBrandModelVariant(supabase, {
    brand_id: input.brand_id,
    brand_model_id: input.brand_model_id,
    length_label: input.length_label,
    width_label: input.width_label,
    thickness_label: input.thickness_label,
    volume_label: input.volume_label,
    fin_box_type: input.fin_box_type,
    fin_boxes: input.fin_boxes ?? BRAND_MODEL_VARIANT_DEFAULT_FIN_BOXES,
    material: input.material ?? BRAND_MODEL_VARIANT_DEFAULT_MATERIAL,
    condition: input.condition,
    fin_size: input.fin_size ?? null,
    configuration_label: input.configuration_label ?? "",
    fin_base_label: input.fin_base_label ?? "",
    fin_height_label: input.fin_height_label ?? "",
    fin_foil_label: input.fin_foil_label ?? "",
    fin_color_label: input.fin_color_label ?? "",
    product_category_slug: productCategorySlug,
    price: input.price ?? null,
    image_url: input.image_url,
    sort_order: sortOrder,
  })
  if (!result.ok) {
    const status = result.code === "23505" ? 409 : result.code === "23503" ? 404 : 500
    return { ok: false, error: result.error, status }
  }
  return { ok: true, row: result.row }
}

export async function updateBrandModelVariantService(
  supabase: SupabaseClient,
  id: string,
  patch: {
    length_label?: string
    width_label?: string
    thickness_label?: string
    volume_label?: string
    fin_box_type?: FinBoxType
    fin_boxes?: FinBoxesType
    material?: BrandModelVariantMaterial
    condition?: BrandModelVariantCondition
    fin_size?: FinCatalogVariantSize | null
    configuration_label?: string
    fin_base_label?: string
    fin_height_label?: string
    fin_foil_label?: string
    fin_color_label?: string
    product_category_slug?: BrandProductCategorySlug
    price?: number | null
    image_url?: string | null
    sort_order?: number
  },
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const result = await updateBrandModelVariant(supabase, id, patch)
  if (!result.ok) {
    const status = result.code === "23505" ? 409 : 500
    return { ok: false, error: result.error, status }
  }
  return { ok: true }
}

export async function deleteBrandModelVariantService(
  supabase: SupabaseClient,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  const result = await deleteBrandModelVariant(supabase, id)
  if (!result.ok) {
    const isNotFound = /not found/i.test(result.error)
    return { ok: false, error: result.error, status: isNotFound ? 404 : 500 }
  }
  return { ok: true }
}
