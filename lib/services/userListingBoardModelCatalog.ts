import type { SupabaseClient } from "@supabase/supabase-js"
import { z } from "zod"

import type { BrandModelVariantCondition } from "@/lib/validations/brand-model-variants"
import {
  adminBrandModelVariantCreateBodySchema,
  catalogOptionalStoredImageUrlSchema,
  finBoxTypeSchema,
} from "@/lib/validations/brand-model-variants"
import { createBrandModelService } from "@/lib/services/brandModels"
import { createBrandModelVariantService } from "@/lib/services/brandModelVariants"
import {
  getUserListingBoardModelDataByIdForAdmin,
  linkSnapshotToConvertedVariant,
} from "@/lib/db/user-listing-board-model-data"

const uuid = z.string().trim().uuid()

/** Labels may be empty when snapshot data is incomplete; persisted as trimmed text (incl. ""). */
const convertSnapshotDimLabel = z.string().trim().max(80)

export const convertUserListingBoardModelDataBodySchema = z.discriminatedUnion("mode", [
  z.object({
    mode: z.literal("existing_model"),
    brand_model_id: uuid,
    length_label: convertSnapshotDimLabel,
    width_label: convertSnapshotDimLabel,
    thickness_label: convertSnapshotDimLabel,
    volume_label: convertSnapshotDimLabel,
    fin_box_type: finBoxTypeSchema,
    condition: adminBrandModelVariantCreateBodySchema.shape.condition,
    price: z.union([z.number().positive(), z.null()]).optional(),
    variant_image_url: catalogOptionalStoredImageUrlSchema.optional(),
  }),
  z.object({
    mode: z.literal("new_model"),
    new_model_name: z.string().trim().min(1).max(200),
    new_model_description: z.union([z.string().max(8000), z.null()]).optional(),
    new_model_image_url: catalogOptionalStoredImageUrlSchema.optional(),
    length_label: convertSnapshotDimLabel,
    width_label: convertSnapshotDimLabel,
    thickness_label: convertSnapshotDimLabel,
    volume_label: convertSnapshotDimLabel,
    fin_box_type: finBoxTypeSchema,
    condition: adminBrandModelVariantCreateBodySchema.shape.condition,
    price: z.union([z.number().positive(), z.null()]).optional(),
    variant_image_url: catalogOptionalStoredImageUrlSchema.optional(),
  }),
])

export type ConvertUserListingBoardModelDataBody = z.infer<typeof convertUserListingBoardModelDataBodySchema>

export async function convertUserListingBoardModelDataService(
  supabase: SupabaseClient,
  snapshotId: string,
  body: ConvertUserListingBoardModelDataBody,
): Promise<
  | { ok: true; variantId: string; brandModelId: string }
  | { ok: false; error: string; status: number }
> {
  const snap = await getUserListingBoardModelDataByIdForAdmin(supabase, snapshotId)
  if (!snap) {
    return { ok: false, error: "Snapshot not found", status: 404 }
  }
  if (!snap.brand_id) {
    return { ok: false, error: "This row has no brand — attach a catalog brand from the snapshots table first", status: 400 }
  }
  if (snap.converted_brand_model_variant_id) {
    return { ok: false, error: "This snapshot was already converted", status: 400 }
  }

  const brandId = snap.brand_id
  let brandModelId: string

  if (body.mode === "existing_model") {
    const { data: model, error } = await supabase
      .from("brand_models")
      .select("id, brand_id")
      .eq("id", body.brand_model_id)
      .maybeSingle()

    if (error || !model) {
      return { ok: false, error: "Model not found", status: 404 }
    }
    if (model.brand_id !== brandId) {
      return { ok: false, error: "Selected model belongs to a different brand", status: 400 }
    }
    brandModelId = model.id
  } else {
    const newModelHero =
      typeof body.new_model_image_url === "string" &&
      URL.canParse(body.new_model_image_url.trim())
        ? body.new_model_image_url.trim()
        : null

    const created = await createBrandModelService(supabase, {
      brand_id: brandId,
      name: body.new_model_name,
      description:
        typeof body.new_model_description === "string" &&
        body.new_model_description.trim()
          ? body.new_model_description.trim()
          : null,
      image_url: newModelHero,
    })
    if (!created.ok) {
      const st = created.status ?? 500
      return { ok: false, error: created.error, status: st }
    }
    brandModelId = created.row.id
  }

  const price =
    body.price !== undefined ? body.price ?? null : snap.listing_price > 0 ? snap.listing_price : null

  const variantImage =
    typeof body.variant_image_url === "string" && URL.canParse(body.variant_image_url.trim())
      ? body.variant_image_url.trim()
      : null

  const variant = await createBrandModelVariantService(supabase, {
    brand_id: brandId,
    brand_model_id: brandModelId,
    length_label: body.length_label,
    width_label: body.width_label,
    thickness_label: body.thickness_label,
    volume_label: body.volume_label,
    fin_box_type: body.fin_box_type,
    condition: body.condition as BrandModelVariantCondition,
    price,
    image_url: variantImage,
  })

  if (!variant.ok) {
    return { ok: false, error: variant.error, status: variant.status ?? 500 }
  }

  const link = await linkSnapshotToConvertedVariant(supabase, snapshotId, variant.row.id)
  if (!link.ok) {
    return { ok: false, error: link.error || "Variant created but linking this snapshot failed", status: 500 }
  }

  return { ok: true, variantId: variant.row.id, brandModelId }
}
