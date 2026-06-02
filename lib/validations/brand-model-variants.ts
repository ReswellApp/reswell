import { z } from "zod"

const uuid = z.string().trim().uuid()

/** Admin / snapshot flows: empty labels allowed (stored as trimmed text, may be ""). */
export const adminOptionalDimLabelSchema = z.string().trim().max(80)

const optionalDimLabel80 = adminOptionalDimLabelSchema

/**
 * Catalog variant vocab is kept 1:1 with the marketplace listing facets so the admin
 * Convert + variant editors offer the exact same options as the pro browse filters.
 * Labels live in `@/lib/boards-browse-facets` (FIN_SYSTEM_OPTIONS / FIN_SETUP_OPTIONS /
 * CONSTRUCTION_OPTIONS); keep these value tuples in sync with that source of truth.
 */

/** Fin system / plug routing — mirrors `listings.fin_system`. */
export const finBoxTypeSchema = z.enum([
  "futures",
  "fcs_ii",
  "fcs_twin_tab",
  "single",
  "two_plus_one_futures",
  "two_plus_one_fcs",
  "glass_on",
  "other",
])

export type FinBoxType = z.infer<typeof finBoxTypeSchema>

/** Fin setup / layout — mirrors `listings.fins_setup`. */
export const finBoxesSchema = z.enum([
  "single",
  "twin_only",
  "twin",
  "thruster",
  "quad",
  "five",
  "other",
])

export type FinBoxesType = z.infer<typeof finBoxesSchema>

/** Board construction — mirrors `listings.construction`. */
export const brandModelVariantMaterialSchema = z.enum([
  "eps_epoxy",
  "pu_poly",
  "carbon",
  "other",
])

export type BrandModelVariantMaterial = z.infer<typeof brandModelVariantMaterialSchema>

export const BRAND_MODEL_VARIANT_DEFAULT_FIN_BOX_TYPE: FinBoxType = "futures"
export const BRAND_MODEL_VARIANT_DEFAULT_FIN_BOXES: FinBoxesType = "thruster"
export const BRAND_MODEL_VARIANT_DEFAULT_MATERIAL: BrandModelVariantMaterial = "pu_poly"

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
  length_label: optionalDimLabel80,
  width_label: optionalDimLabel80,
  thickness_label: optionalDimLabel80,
  volume_label: optionalDimLabel80,
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
  length_label: optionalDimLabel80.optional(),
  width_label: optionalDimLabel80.optional(),
  thickness_label: optionalDimLabel80.optional(),
  volume_label: optionalDimLabel80.optional(),
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
