import { z } from "zod"

export const listingHomepageVisibilityBodySchema = z.object({
  hidden_from_homepage: z.boolean(),
})
