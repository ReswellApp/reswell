import { z } from "zod"

const uuid = z.string().trim().uuid()

/** Omitted, null, or "" → null/undefined; otherwise trimmed https URL string. */
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

export const adminBrandModelCreateBodySchema = z.object({
  brand_id: uuid,
  name: z.string().trim().min(1, "Name is required").max(200),
  description: z.string().trim().max(2000).optional().nullable(),
  image_url: optionalImageUrl,
})

export type AdminBrandModelCreateBody = z.infer<typeof adminBrandModelCreateBodySchema>

export const adminBrandModelPatchBodySchema = z.object({
  name: z.string().trim().min(1).max(200).optional(),
  description: z.string().trim().max(2000).nullable().optional(),
  brand_id: uuid.optional(),
  image_url: optionalImageUrl,
})

export type AdminBrandModelPatchBody = z.infer<typeof adminBrandModelPatchBodySchema>

export const adminBrandModelsListQuerySchema = z.object({
  brand_id: uuid.optional(),
})
