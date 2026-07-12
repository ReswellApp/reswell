import { z } from "zod"

const optionalTrimmedText = z
  .union([z.string().trim().max(10_000), z.null()])
  .transform((v) => (v && v.length ? v : null))

const optionalUrl = z
  .union([z.string().trim().max(2048), z.null()])
  .transform((v) => (v && v.length ? v : null))
  .refine((v) => v === null || /^https?:\/\//i.test(v), {
    message: "Must be an http(s) URL.",
  })

const optionalPrice = z
  .union([
    z.number().nonnegative().max(999_999.99),
    z
      .string()
      .trim()
      .transform((v) => (v.length ? v.replace(/,/g, "") : ""))
      .refine((v) => v === "" || /^\d+(\.\d{1,2})?$/.test(v), {
        message: "Price must be a valid dollar amount.",
      })
      .transform((v) => (v === "" ? null : Number(v))),
    z.literal(""),
    z.null(),
  ])
  .transform((v) => (v === "" ? null : v))

export const fbMarketplaceCatalogInsertSchema = z.object({
  name: z.string().trim().min(1).max(500),
  price: optionalPrice,
  location: optionalTrimmedText,
  image_url: optionalUrl,
  condition: optionalTrimmedText,
  description: optionalTrimmedText,
  source_url: optionalUrl,
  admin_notes: optionalTrimmedText.optional(),
})

export type FbMarketplaceCatalogInsertInput = z.infer<typeof fbMarketplaceCatalogInsertSchema>

export const fbMarketplaceCatalogUpdateSchema = fbMarketplaceCatalogInsertSchema.partial().extend({
  dismissed_at: z.union([z.string().datetime(), z.null()]).optional(),
  converted_brand_model_variant_id: z.union([z.string().uuid(), z.null()]).optional(),
  converted_at: z.union([z.string().datetime(), z.null()]).optional(),
})

export type FbMarketplaceCatalogUpdateInput = z.infer<typeof fbMarketplaceCatalogUpdateSchema>

export const fbMarketplaceCatalogBulkInsertSchema = z
  .array(fbMarketplaceCatalogInsertSchema)
  .min(1)
  .max(5_000)
