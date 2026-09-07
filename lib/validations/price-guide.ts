import { z } from "zod"
import { PRICE_GUIDE_CATEGORY_SLUGS } from "@/lib/price-guide/categories"

const optionalMoney = z
  .union([z.number(), z.string(), z.null()])
  .optional()
  .transform((value) => {
    if (value == null || value === "") return null
    const n = typeof value === "number" ? value : Number(value)
    if (!Number.isFinite(n) || n < 0) return null
    return Math.round(n * 100) / 100
  })

const optionalText = (max: number) =>
  z
    .union([z.string(), z.null()])
    .optional()
    .transform((value) => {
      if (value == null) return null
      const trimmed = value.trim()
      return trimmed.length > 0 ? trimmed.slice(0, max) : null
    })

export const priceGuideConditionBandSchema = z.object({
  condition: z.string().min(1).max(32),
  condition_label: z.string().min(1).max(64),
  low_usd: z.number().nonnegative().nullable(),
  mid_usd: z.number().nonnegative().nullable(),
  high_usd: z.number().nonnegative().nullable(),
  sample_count: z.number().int().nonnegative().optional().default(0),
})

export const priceGuideEntryCreateSchema = z.object({
  category_slug: z.enum(PRICE_GUIDE_CATEGORY_SLUGS),
  brand_id: z.string().uuid().nullable().optional(),
  brand_model_id: z.string().uuid().nullable().optional(),
})

export const priceGuideEntryUpdateSchema = z.object({
  status: z.enum(["draft", "published"]).optional(),
  featured: z.boolean().optional(),
  sort_order: z.number().int().min(0).max(9999).optional(),
  pricing_source: z.enum(["market", "editorial", "mixed"]).optional(),
  typical_low_usd: optionalMoney,
  typical_mid_usd: optionalMoney,
  typical_high_usd: optionalMoney,
  new_retail_usd: optionalMoney,
  condition_bands: z.array(priceGuideConditionBandSchema).max(12).optional(),
  headline: optionalText(160),
  summary: optionalText(400),
  body: optionalText(8000),
  confidence: z.enum(["thin", "emerging", "solid", "expert"]).nullable().optional(),
  notes_internal: optionalText(4000),
  mark_reviewed: z.boolean().optional(),
})

export const priceGuideCompCreateSchema = z.object({
  sold_price_usd: z.coerce.number().positive().max(100000),
  sold_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  condition: optionalText(32),
  dimensions: optionalText(80),
  title: optionalText(200),
  source: z.enum(["reswell", "fb_marketplace", "craigslist", "ebay", "shop", "other"]),
  source_url: optionalText(500),
  notes: optionalText(500),
  include_in_public: z.boolean().optional().default(true),
  listing_id: z.string().uuid().nullable().optional(),
})

export const priceGuideAdminListQuerySchema = z.object({
  status: z.enum(["draft", "published", "all"]).optional().default("all"),
  category_slug: z.enum(PRICE_GUIDE_CATEGORY_SLUGS).optional(),
  q: z.string().max(120).optional(),
})

export const priceGuideMarketQuerySchema = z.object({
  category_slug: z.enum(PRICE_GUIDE_CATEGORY_SLUGS),
  brand_id: z.string().uuid().optional(),
  brand_model_id: z.string().uuid().optional(),
})

export const priceGuideCatalogQuerySchema = z.object({
  q: z.string().min(1).max(80),
  category_slug: z.enum(PRICE_GUIDE_CATEGORY_SLUGS).optional(),
})
