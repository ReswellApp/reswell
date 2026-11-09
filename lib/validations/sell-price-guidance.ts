import { z } from "zod"
import { LISTING_SELLABLE_CONDITIONS } from "@/lib/listing-labels"

/** Sell price guidance is scoped to surfboards + fins for the first ship. */
export const SELL_PRICE_GUIDANCE_CATEGORY_SLUGS = ["surfboards", "fins"] as const

export type SellPriceGuidanceCategorySlug =
  (typeof SELL_PRICE_GUIDANCE_CATEGORY_SLUGS)[number]

const sellableConditionSet = new Set<string>(LISTING_SELLABLE_CONDITIONS)

export const sellPriceGuidanceQuerySchema = z.object({
  category_slug: z.enum(SELL_PRICE_GUIDANCE_CATEGORY_SLUGS),
  brand_id: z.string().trim().uuid(),
  brand_model_id: z.string().trim().uuid(),
  condition: z
    .string()
    .trim()
    .max(32)
    .optional()
    .transform((value) => {
      if (!value) return null
      return sellableConditionSet.has(value) ? value : null
    }),
})

export type SellPriceGuidanceQuery = z.infer<typeof sellPriceGuidanceQuerySchema>

export function isSellPriceGuidanceCategorySlug(
  value: string,
): value is SellPriceGuidanceCategorySlug {
  return (SELL_PRICE_GUIDANCE_CATEGORY_SLUGS as readonly string[]).includes(value)
}
