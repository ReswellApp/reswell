import { z } from "zod"

const uuid = z.string().trim().uuid()

const dimLabel80 = z.string().trim().min(1, "Required").max(80)

export const finBoxTypeSchema = z.enum(["futures", "fcs", "single_fin"])

export type FinBoxType = z.infer<typeof finBoxTypeSchema>

/** Fin layout / routing (distinct from plug type / `fin_box_type`). */
export const finBoxesSchema = z.enum([
  "five_fin",
  "thruster",
  "quad",
  "single_fin",
  "two_plus_one",
  "twinzer",
])

export type FinBoxesType = z.infer<typeof finBoxesSchema>

export const brandModelVariantMaterialSchema = z.enum(["pu", "eps"])

export type BrandModelVariantMaterial = z.infer<typeof brandModelVariantMaterialSchema>

export const BRAND_MODEL_VARIANT_DEFAULT_FIN_BOXES: FinBoxesType = "thruster"
export const BRAND_MODEL_VARIANT_DEFAULT_MATERIAL: BrandModelVariantMaterial = "pu"

/** Same value set as listings (sellable / browse) — see LISTING_CONDITION_LABELS. */
export const brandModelVariantConditionSchema = z.enum([
  "brand_new",
  "excellent",
  "very_good",
  "good",
  "fair",
  "poor",
])

export type BrandModelVariantCondition = z.infer<typeof brandModelVariantConditionSchema>

/** USD amount; empty / omitted / null = no price stored. */
const optionalPriceUsd = z.preprocess(
  (v: unknown) => {
    if (v === undefined) return undefined
    if (v === null) return null
    if (typeof v === "number" && Number.isFinite(v)) return v
    if (typeof v === "string") {
      const t = v.trim()
      if (t === "") return null
      const n = Number(t)
      return Number.isFinite(n) ? n : v
    }
    return v
  },
  z
    .union([z.undefined(), z.null(), z.number().positive().max(999_999.99)])
    .optional(),
)

/** Optional stored image pointer (omit / null / "" = unset). Exported for snapshot→catalog convert flow. */
export const catalogOptionalStoredImageUrlSchema = z.preprocess(
  (v: unknown) => {
    if (v === undefined) return undefined
    if (v === null || v === "") return null
    if (typeof v !== "string") return v
    const t = v.trim()
    return t === "" ? null : t
  },
  z
    .union([z.undefined(), z.null(), z.string().max(2048)])
    .refine((s) => s === undefined || s === null || URL.canParse(s), { message: "Invalid image URL" }),
)

const optionalImageUrl = catalogOptionalStoredImageUrlSchema

export const adminBrandModelVariantCreateBodySchema = z.object({
  brand_model_id: uuid,
  /** Denormalized; DB trigger overwrites from parent model if mismatched. */
  brand_id: uuid,
  length_label: dimLabel80,
  width_label: dimLabel80,
  thickness_label: dimLabel80,
  volume_label: dimLabel80,
  fin_box_type: finBoxTypeSchema,
  fin_boxes: finBoxesSchema.optional(),
  material: brandModelVariantMaterialSchema.optional(),
  condition: brandModelVariantConditionSchema,
  price: optionalPriceUsd,
  image_url: optionalImageUrl,
  sort_order: z.number().int().min(0).max(1_000_000).optional(),
})

export type AdminBrandModelVariantCreateBody = z.infer<typeof adminBrandModelVariantCreateBodySchema>

export const adminBrandModelVariantPatchBodySchema = z.object({
  length_label: dimLabel80.optional(),
  width_label: dimLabel80.optional(),
  thickness_label: dimLabel80.optional(),
  volume_label: dimLabel80.optional(),
  fin_box_type: finBoxTypeSchema.optional(),
  fin_boxes: finBoxesSchema.optional(),
  material: brandModelVariantMaterialSchema.optional(),
  condition: brandModelVariantConditionSchema.optional(),
  price: optionalPriceUsd,
  image_url: optionalImageUrl,
  sort_order: z.number().int().min(0).max(1_000_000).optional(),
})

export type AdminBrandModelVariantPatchBody = z.infer<typeof adminBrandModelVariantPatchBodySchema>

export const adminBrandModelVariantsListQuerySchema = z.object({
  brand_model_id: uuid,
})
