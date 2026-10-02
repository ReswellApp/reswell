import { z } from "zod"

/**
 * Generic peer-listing bounds. Surfboard listings are additionally rejected
 * under $50 in `updateSellerListingQuickPrice`.
 */
const PRICE_MIN = 0.01
const PRICE_MAX = 999_999.99

export const listingQuickPriceBodySchema = z.object({
  priceUsd: z.coerce.number().min(PRICE_MIN).max(PRICE_MAX),
  showPriceMarkdown: z.boolean().optional(),
})

export type ListingQuickPriceBody = z.infer<typeof listingQuickPriceBodySchema>
