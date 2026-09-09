import { z } from "zod"

export const listingGoodDealBodySchema = z.object({
  is_good_deal: z.boolean(),
})
