import type { SupabaseClient } from "@supabase/supabase-js"

export type CatalogVolumeCalibrationDbRow = {
  id: string
  brand_id: string
  brand_model_id: string
  length_label: string
  width_label: string
  thickness_label: string
  volume_label: string
  brand_name: string
  brand_slug: string
  model_name: string
  board_category_slug: string | null
}

const PAGE = 1000

/**
 * Surfboard stock sizes with a volume label — calibration corpus for the admin
 * catalog-calibrated volume prototype.
 */
export async function listSurfboardVolumeCalibrationRows(
  supabase: SupabaseClient,
): Promise<CatalogVolumeCalibrationDbRow[]> {
  const out: CatalogVolumeCalibrationDbRow[] = []
  let from = 0

  for (;;) {
    const { data, error } = await supabase
      .from("brand_model_variants")
      .select(
        `
        id,
        brand_id,
        brand_model_id,
        length_label,
        width_label,
        thickness_label,
        volume_label,
        brands:brand_id ( name, slug ),
        brand_models:brand_model_id ( name, board_category_slug )
      `,
      )
      .eq("product_category_slug", "surfboards")
      .neq("volume_label", "")
      .order("brand_id", { ascending: true })
      .order("brand_model_id", { ascending: true })
      .order("sort_order", { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE - 1)

    if (error) {
      console.error("listSurfboardVolumeCalibrationRows:", error.message)
      break
    }

    type Joined = {
      id: string
      brand_id: string
      brand_model_id: string
      length_label: string | null
      width_label: string | null
      thickness_label: string | null
      volume_label: string | null
      brands: { name: string; slug: string } | { name: string; slug: string }[] | null
      brand_models:
        | { name: string; board_category_slug: string | null }
        | { name: string; board_category_slug: string | null }[]
        | null
    }

    const batch = (data ?? []) as Joined[]
    for (const row of batch) {
      const volumeLabel = row.volume_label?.trim() ?? ""
      if (!volumeLabel) continue

      const brand = Array.isArray(row.brands) ? row.brands[0] ?? null : row.brands
      const model = Array.isArray(row.brand_models)
        ? row.brand_models[0] ?? null
        : row.brand_models

      const brandName = brand?.name?.trim() ?? ""
      const brandSlug = brand?.slug?.trim() ?? ""
      const modelName = model?.name?.trim() ?? ""
      if (!brandName || !modelName) continue

      out.push({
        id: row.id,
        brand_id: row.brand_id,
        brand_model_id: row.brand_model_id,
        length_label: row.length_label ?? "",
        width_label: row.width_label ?? "",
        thickness_label: row.thickness_label ?? "",
        volume_label: volumeLabel,
        brand_name: brandName,
        brand_slug: brandSlug,
        model_name: modelName,
        board_category_slug: model?.board_category_slug ?? null,
      })
    }

    if (batch.length < PAGE) break
    from += PAGE
  }

  return out
}
