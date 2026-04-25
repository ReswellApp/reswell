import { z } from "zod"

const uuid = z.string().trim().uuid()

const dimLabel80 = z.string().trim().min(1, "Required").max(80)

export const finBoxTypeSchema = z.enum(["futures", "fcs", "single_fin"])

export type FinBoxType = z.infer<typeof finBoxTypeSchema>

const optionalImageUrl = z.preprocess(
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

export const adminBrandModelVariantCreateBodySchema = z.object({
  brand_model_id: uuid,
  /** Denormalized; DB trigger overwrites from parent model if mismatched. */
  brand_id: uuid,
  length_label: dimLabel80,
  width_label: dimLabel80,
  thickness_label: dimLabel80,
  volume_label: dimLabel80,
  fin_box_type: finBoxTypeSchema,
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
  image_url: optionalImageUrl,
  sort_order: z.number().int().min(0).max(1_000_000).optional(),
})

export type AdminBrandModelVariantPatchBody = z.infer<typeof adminBrandModelVariantPatchBodySchema>

export const adminBrandModelVariantsListQuerySchema = z.object({
  brand_model_id: uuid,
})
