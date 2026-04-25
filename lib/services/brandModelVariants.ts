import type { SupabaseClient } from "@supabase/supabase-js"
import {
  deleteBrandModelVariant,
  insertBrandModelVariant,
  listBrandModelVariantsForAdmin,
  maxSortOrderForBrandModel,
  updateBrandModelVariant,
  type BrandModelVariantRow,
  type FinBoxType,
} from "@/lib/db/brand-model-variants"

export type { BrandModelVariantRow, FinBoxType }

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
    image_url: string | null
    sort_order?: number
  },
): Promise<{ ok: true; row: BrandModelVariantRow } | { ok: false; error: string; status?: number }> {
  const { data: model, error: modelErr } = await supabase
    .from("brand_models")
    .select("id, brand_id")
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
