import type { SupabaseClient } from "@supabase/supabase-js"
import type { BrandModelVariantCondition } from "@/lib/validations/brand-model-variants"

export type FinBoxType = "futures" | "fcs" | "single_fin"

export type BrandModelVariantRow = {
  id: string
  brand_id: string
  brand_model_id: string
  length_label: string
  width_label: string
  thickness_label: string
  volume_label: string
  fin_box_type: FinBoxType
  condition: BrandModelVariantCondition
  /** USD; null when unset. Postgres numeric may arrive as string from PostgREST. */
  price: number | null
  image_url: string | null
  sort_order: number
  created_at: string
  updated_at: string
}

function normalizeNullableMoney(v: unknown): number | null {
  if (v == null) return null
  if (typeof v === "number" && Number.isFinite(v)) return v
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

export async function listBrandModelVariantsForAdmin(
  supabase: SupabaseClient,
  brandModelId: string,
): Promise<BrandModelVariantRow[]> {
  const { data, error } = await supabase
    .from("brand_model_variants")
    .select(
      "id, brand_id, brand_model_id, length_label, width_label, thickness_label, volume_label, fin_box_type, condition, price, image_url, sort_order, created_at, updated_at",
    )
    .eq("brand_model_id", brandModelId)
    .order("sort_order", { ascending: true })
    .order("length_label", { ascending: true })

  if (error) {
    console.error("listBrandModelVariantsForAdmin:", error.message)
    return []
  }
  const rows = (data ?? []) as Record<string, unknown>[]
  return rows.map((r) => ({
    ...(r as Omit<BrandModelVariantRow, "price">),
    price: normalizeNullableMoney(r.price),
  })) as BrandModelVariantRow[]
}

export async function insertBrandModelVariant(
  supabase: SupabaseClient,
  input: {
    brand_id: string
    brand_model_id: string
    length_label: string
    width_label: string
    thickness_label: string
    volume_label: string
    fin_box_type: FinBoxType
    condition: BrandModelVariantCondition
    price: number | null
    image_url: string | null
    sort_order: number
  },
): Promise<{ ok: true; row: BrandModelVariantRow } | { ok: false; error: string; code?: string }> {
  const now = new Date().toISOString()
  const { data, error } = await supabase
    .from("brand_model_variants")
    .insert({
      brand_id: input.brand_id,
      brand_model_id: input.brand_model_id,
      length_label: input.length_label.trim(),
      width_label: input.width_label.trim(),
      thickness_label: input.thickness_label.trim(),
      volume_label: input.volume_label.trim(),
      fin_box_type: input.fin_box_type,
      condition: input.condition,
      price: input.price,
      image_url: input.image_url,
      sort_order: input.sort_order,
      updated_at: now,
    })
    .select(
      "id, brand_id, brand_model_id, length_label, width_label, thickness_label, volume_label, fin_box_type, condition, price, image_url, sort_order, created_at, updated_at",
    )
    .single()

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "This size, fin system, and condition already exist for this model",
        code: error.code,
      }
    }
    if (error.code === "23503") {
      return { ok: false, error: "Model or brand not found", code: error.code }
    }
    if (
      error.code === "23514" &&
      typeof error.message === "string" &&
      error.message.includes("brand_model_variants_labels_nonempty")
    ) {
      return {
        ok: false,
        error:
          "This database still requires every dimension label to be filled. Apply migration 20260628130000_brand_model_variants_optional_dim_labels, or temporarily enter non-empty values for all four labels.",
        code: error.code,
      }
    }
    console.error("insertBrandModelVariant:", error.message)
    return { ok: false, error: error.message }
  }
  const row = data as Record<string, unknown>
  return {
    ok: true,
    row: {
      ...(row as Omit<BrandModelVariantRow, "price">),
      price: normalizeNullableMoney(row.price),
    } as BrandModelVariantRow,
  }
}

export async function updateBrandModelVariant(
  supabase: SupabaseClient,
  id: string,
  patch: {
    length_label?: string
    width_label?: string
    thickness_label?: string
    volume_label?: string
    fin_box_type?: FinBoxType
    condition?: BrandModelVariantCondition
    price?: number | null
    image_url?: string | null
    sort_order?: number
  },
): Promise<{ ok: true } | { ok: false; error: string; code?: string }> {
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (patch.length_label !== undefined) updates.length_label = patch.length_label.trim()
  if (patch.width_label !== undefined) updates.width_label = patch.width_label.trim()
  if (patch.thickness_label !== undefined) updates.thickness_label = patch.thickness_label.trim()
  if (patch.volume_label !== undefined) updates.volume_label = patch.volume_label.trim()
  if (patch.fin_box_type !== undefined) updates.fin_box_type = patch.fin_box_type
  if (patch.condition !== undefined) updates.condition = patch.condition
  if (patch.price !== undefined) updates.price = patch.price
  if (patch.image_url !== undefined) updates.image_url = patch.image_url
  if (patch.sort_order !== undefined) updates.sort_order = patch.sort_order

  const { error } = await supabase.from("brand_model_variants").update(updates).eq("id", id)

  if (error) {
    if (error.code === "23505") {
      return {
        ok: false,
        error: "This size, fin system, and condition already exist for this model",
        code: error.code,
      }
    }
    console.error("updateBrandModelVariant:", error.message)
    return { ok: false, error: error.message }
  }
  return { ok: true }
}

export async function deleteBrandModelVariant(
  supabase: SupabaseClient,
  id: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data, error } = await supabase.from("brand_model_variants").delete().eq("id", id).select("id")

  if (error) {
    console.error("deleteBrandModelVariant:", error.message)
    return { ok: false, error: error.message }
  }
  if (!data?.length) {
    return { ok: false, error: "Variant not found" }
  }
  return { ok: true }
}

export async function maxSortOrderForBrandModel(
  supabase: SupabaseClient,
  brandModelId: string,
): Promise<number> {
  const { data, error } = await supabase
    .from("brand_model_variants")
    .select("sort_order")
    .eq("brand_model_id", brandModelId)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) {
    console.error("maxSortOrderForBrandModel:", error.message)
    return -1
  }
  const n = data?.sort_order
  return typeof n === "number" ? n : -1
}
