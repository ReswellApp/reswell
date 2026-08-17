import { z } from "zod"

export const PUBLIC_API_SEARCH_TYPES = ["models", "listings"] as const
export type PublicApiSearchType = (typeof PUBLIC_API_SEARCH_TYPES)[number]

export const publicApiSearchQuerySchema = z.object({
  q: z.string().trim().min(1, "q is required").max(200),
  type: z.enum(PUBLIC_API_SEARCH_TYPES).default("models"),
  limit: z.coerce.number().int().min(1).max(10).default(5),
})

export const publicApiPricingQuerySchema = z.object({
  brand: z.string().trim().min(1, "brand is required").max(120),
  model: z.string().trim().max(120).optional(),
})

export const publicApiListingParamSchema = z.object({
  id: z.string().trim().min(1, "id is required").max(160),
})

export type PublicApiSearchQuery = z.infer<typeof publicApiSearchQuerySchema>
export type PublicApiPricingQuery = z.infer<typeof publicApiPricingQuerySchema>
