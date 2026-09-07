import { z } from "zod"

/** Mirrors sell-flow listing price bounds (see `lib/sell-form-validation.ts`). */
const PRICE_MIN = 0.01
const PRICE_MAX = 999_999.99

export const listingQuickPriceBodySchema = z.object({
  priceUsd: z.coerce.number().min(PRICE_MIN).max(PRICE_MAX),
  showPriceMarkdown: z.boolean().optional(),
})

export type ListingQuickPriceBody = z.infer<typeof listingQuickPriceBodySchema>
