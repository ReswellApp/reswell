import { z } from "zod"

export const listingGoogleMerchantExclusionBodySchema = z.object({
  excluded_from_google_merchant: z.boolean(),
})
