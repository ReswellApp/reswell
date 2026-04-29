import type { SupabaseClient } from "@supabase/supabase-js"
import type {
  BrandModelVariantCondition,
  BrandModelVariantMaterial,
  FinBoxesType,
  FinBoxType,
} from "@/lib/validations/brand-model-variants"

export type BrandCatalogImageSourceRow = {
  image_url: string
  brand_model_id: string
  model_name: string
  kind: "model_hero" | "variant"
  /** Only when kind is variant — for display label. */
  variant_dims: null | {
    length_label: string
    width_label: string
    thickness_label: string
    volume_label: string
    fin_box_type: FinBoxType
    fin_boxes: FinBoxesType
    material: BrandModelVariantMaterial
    condition: BrandModelVariantCondition
    price: number | null
  }
}

export async function listBrandCatalogImageSourcesForAdmin(
  supabase: SupabaseClient,
  brandId: string,
): Promise<BrandCatalogImageSourceRow[]> {
  const { data: models, error: modelsErr } = await supabase
    .from("brand_models")
    .select("id, name, image_url")
    .eq("brand_id", brandId)

  if (modelsErr) {
    console.error("listBrandCatalogImageSourcesForAdmin (models):", modelsErr.message)
    return []
  }

  const modelRows = (models ?? []) as { id: string; name: string; image_url: string | null }[]
  const nameById = new Map(modelRows.map((m) => [m.id, m.name.trim() || "Model"]))

  const { data: variants, error: variantsErr } = await supabase
    .from("brand_model_variants")
    .select(
      "image_url, brand_model_id, length_label, width_label, thickness_label, volume_label, fin_box_type, fin_boxes, material, condition, price",
    )
    .eq("brand_id", brandId)
    .not("image_url", "is", null)

  if (variantsErr) {
    console.error("listBrandCatalogImageSourcesForAdmin (variants):", variantsErr.message)
  }

  const variantRows = (variants ?? []) as {
    image_url: string
    brand_model_id: string
    length_label: string
    width_label: string
    thickness_label: string
    volume_label: string
    fin_box_type: FinBoxType
    fin_boxes: FinBoxesType
    material: BrandModelVariantMaterial
    condition: BrandModelVariantCondition
    price: unknown
  }[]

  const out: BrandCatalogImageSourceRow[] = []

  for (const m of modelRows) {
    const url = m.image_url?.trim()
    if (!url) continue
    out.push({
      image_url: url,
      brand_model_id: m.id,
      model_name: m.name.trim() || "Model",
      kind: "model_hero",
      variant_dims: null,
    })
  }

  for (const v of variantRows) {
    const url = v.image_url?.trim()
    if (!url) continue
    const modelName = nameById.get(v.brand_model_id) ?? "Model"
    let price: number | null = null
    if (v.price != null) {
      const n = typeof v.price === "number" ? v.price : Number(v.price)
      price = Number.isFinite(n) ? n : null
    }
    out.push({
      image_url: url,
      brand_model_id: v.brand_model_id,
      model_name: modelName,
      kind: "variant",
      variant_dims: {
        length_label: v.length_label,
        width_label: v.width_label,
        thickness_label: v.thickness_label,
        volume_label: v.volume_label,
        fin_box_type: v.fin_box_type,
        fin_boxes: v.fin_boxes,
        material: v.material,
        condition: v.condition,
        price,
      },
    })
  }

  return out
}
