import { z } from "zod"

export const brandCatalogImagePickerSourceSchema = z.enum([
  "catalog",
  "live_listings",
  "sold_listings",
])

export const adminBrandCatalogImagesQuerySchema = z.object({
  brand_id: z.string().uuid("Invalid brand"),
  focus_brand_model_id: z.string().uuid().optional().nullable(),
  source: brandCatalogImagePickerSourceSchema.optional().default("catalog"),
})
